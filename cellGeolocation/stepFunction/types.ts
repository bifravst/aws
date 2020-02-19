import { Cell } from '../geolocateCell'

export type CellGeoInput = { roaming: Cell; deviceId: string }

export type CellGeoResponse = {
	located: boolean
	area: number
	mccmnc: number
	cell: number
	lat?: number
	lng?: number
}
