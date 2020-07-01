import { promises as fs } from 'fs'
import { mqtt, io, iot } from 'aws-crt'
import { deviceFileLocations } from '../jitp/deviceFileLocations'
import { iotshadow } from 'aws-iot-device-sdk-v2'
import * as chalk from 'chalk'
import { isNotNullOrUndefined } from '../../util/isNullOrUndefined'
import { WebSocketConnection, uiServer } from '@bifravst/device-ui-server'

io.enable_logging(io.LogLevel.ERROR)

const defaultConfig = {
	act: false, // Whether to enable the active mode
	actwt: 60, //In active mode: wait this amount of seconds until sending the next update. The actual interval will be this time plus the time it takes to get a GPS fix.
	mvres: 300, // (movement resolution) In passive mode: Time in seconds to wait after detecting movement before sending the next update
	mvt: 3600, // (movement timeout) In passive mode: Send update at least this often (in seconds)
	gpst: 60, // GPS timeout (in seconds): timeout for GPS fix
	celt: 600, // cellular timeout (in seconds): timeout for acquiring cellular connection
	acct: 1, // Accelerometer threshold: minimal absolute value for and accelerometer reading to be considered movement.
} as const

const labeledTimer = (label: string): (() => void) => {
	console.log(chalk.yellow.dim(`${label}...`))
	const doneLabel = chalk.green(`${label} ✔ `)
	console.time(doneLabel)
	return () => {
		console.timeEnd(doneLabel)
	}
}

/**
 * Connect to the AWS IoT broker using a generated device certificate
 */
export const connect = async ({
	deviceId,
	deviceUiUrl,
	certsDir,
	endpoint,
	caCert,
	version,
}: {
	deviceId: string
	endpoint: string
	deviceUiUrl: string
	certsDir: string
	caCert: string
	version: string
}): Promise<void> => {
	// Certificate check
	const deviceFiles = deviceFileLocations({ certsDir, deviceId })
	console.log(chalk.blue('Device ID:   '), chalk.yellow(deviceId))
	console.log(chalk.blue('endpoint:    '), chalk.yellow(endpoint))
	console.log(chalk.blue('deviceUiUrl: '), chalk.yellow(deviceUiUrl))
	console.log(chalk.blue('CA cert:     '), chalk.yellow(caCert))
	console.log(chalk.blue('Private key: '), chalk.yellow(deviceFiles.key))
	console.log(chalk.blue('Certificate: '), chalk.yellow(deviceFiles.certWithCA))
	const certFiles = [deviceFiles.certWithCA, deviceFiles.key, caCert]
	try {
		await Promise.all(
			certFiles.map(async (f) => {
				try {
					await fs.stat(f)
					console.log(chalk.green('✔'), chalk.magenta(f))
				} catch (e) {
					console.log(chalk.red('✖'), chalk.magenta(f))
					throw e
				}
			}),
		)
	} catch (error) {
		console.error(
			chalk.red(`Could not find certificates for device ${deviceId}!`),
		)
		process.exit(1)
	}

	const note = chalk.magenta(
		`Still connecting ... First connect takes around 30 seconds`,
	)
	console.time(note)
	const connectingNote = setInterval(() => {
		console.timeLog(note)
	}, 5000)

	const config_builder = iot.AwsIotMqttConnectionConfigBuilder.new_mtls_builder_from_path(
		deviceFiles.certWithCA,
		deviceFiles.key,
	)
	config_builder.with_certificate_authority_from_path(undefined, caCert)
	config_builder.with_clean_session(true)
	config_builder.with_client_id(deviceId)
	config_builder.with_endpoint(endpoint)

	const config = config_builder.build()
	const client = new mqtt.MqttClient(new io.ClientBootstrap())
	const connection = client.new_connection(config)
	const shadow = new iotshadow.IotShadowClient(connection)
	connection.on('disconnect', () => {
		console.error(chalk.red(' disconnected! '))
	})
	connection.on('resume', () => {
		console.log(chalk.magenta('reconnecting...'))
	})

	const connectingTimer = labeledTimer('connecting')
	setInterval(() => {
		// NOTE! This is needed so the underlying AWS MQTT library does not crash
	}, 60000)
	await connection.connect()
	connectingTimer()
	clearInterval(connectingNote)

	// UI Server
	let wsConnection: WebSocketConnection
	const startingUiServerTimer = labeledTimer('Starting UI server')
	await uiServer({
		deviceUiUrl,
		deviceId: deviceId,
		onUpdate: async (update) => {
			console.log(chalk.magenta('<'), chalk.cyan(JSON.stringify(update)))
			await shadow.publishUpdateShadow(
				{
					thingName: deviceId,
					state: { reported: update },
				},
				mqtt.QoS.AtLeastOnce,
			)
		},
		onMessage: async (message) => {
			console.log(chalk.magenta('<'), chalk.cyan(JSON.stringify(message)))
			await connection.publish(
				`${deviceId}/messages`,
				message,
				mqtt.QoS.AtLeastOnce,
			)
		},
		onWsConnection: async (c) => {
			console.log(chalk.magenta('[ws]'), chalk.cyan('connected'))
			wsConnection = c
			// Fetch current config
			await shadow.publishGetShadow(
				{ thingName: deviceId },
				mqtt.QoS.AtLeastOnce,
			)
		},
	})
	startingUiServerTimer()

	// Configuration management
	let cfg = defaultConfig
	const devRoam = {
		dev: {
			v: {
				band: 666,
				nw: 'LAN',
				modV: 'device-simulator',
				brdV: 'device-simulator',
				appV: version,
				iccid: '12345678901234567890',
			},
			ts: Date.now(),
		},
		roam: {
			v: {
				rsrp: 70,
				area: 30401,
				mccmnc: 24201,
				cell: 16964098,
				ip: '0.0.0.0',
			},
			ts: Date.now(),
		},
	}

	const acceptedTimer = labeledTimer('Subscribing to shadow get accepted')
	await shadow.subscribeToGetShadowAccepted(
		{ thingName: deviceId },
		mqtt.QoS.AtLeastOnce,
		async (error, shadow) => {
			if (isNotNullOrUndefined(error)) {
				console.error(
					chalk.red(`Failed to receive shadow get accepted for ${deviceId}`),
					chalk.redBright(error?.message),
				)
				return
			}
			console.log(chalk.magenta('>'), chalk.cyan(JSON.stringify(shadow)))
			if (wsConnection !== undefined) {
				cfg = {
					...cfg,
					...(shadow?.state?.desired as Record<string, any> | undefined)?.cfg,
				}
				console.log(chalk.magenta('[ws>'), JSON.stringify(cfg))
				wsConnection.send(JSON.stringify(cfg))
			}
		},
	)
	acceptedTimer()

	const deltaTimer = labeledTimer('Subscribing to shadow delta')
	await shadow.subscribeToShadowDeltaUpdatedEvents(
		{
			thingName: deviceId,
		},
		mqtt.QoS.AtLeastOnce,
		(error, stateObject) => {
			if (isNotNullOrUndefined(error)) {
				console.error(
					chalk.red(`Failed to receive shadow delta for ${deviceId}`),
					chalk.redBright(error?.message),
				)
				return
			}
			console.log(chalk.magenta('<'), chalk.cyan(JSON.stringify(stateObject)))
			cfg = {
				...cfg,
				...(stateObject?.state as Record<string, any> | undefined)?.cfg,
			}
			if (wsConnection !== undefined) {
				console.log(chalk.magenta('[ws>'), JSON.stringify(cfg))
				wsConnection.send(JSON.stringify(cfg))
			}
		},
	)
	deltaTimer()

	const currentConfigTimer = labeledTimer('Sending current config')
	console.log(
		chalk.magenta('>'),
		chalk.cyan(JSON.stringify({ state: { reported: { cfg, ...devRoam } } })),
	)
	await shadow.publishUpdateShadow(
		{ thingName: deviceId, state: { reported: { cfg, ...devRoam } } },
		mqtt.QoS.AtLeastOnce,
	)
	currentConfigTimer()
	const getShadowTimer = labeledTimer('Getting shadow')
	await shadow.publishGetShadow(
		{
			thingName: deviceId,
		},
		mqtt.QoS.AtLeastOnce,
	)
	getShadowTimer()
}
