import { App, Stack } from '@aws-cdk/core'

/**
 * This stack provides resources for the End-to-end tests
 */
export class TestStack extends Stack {
	public constructor(parent: App, id: string) {
		super(parent, id)
	}
}

export const stackId = (args: { bifravstStackName: string }) =>
	args.bifravstStackName + '-test'
