import { App } from '@aws-cdk/core'
import { TestStack } from '../stacks/Test'

/**
 * This app provides resources used only for end-to-end tests
 */
export class TestApp extends App {
	public constructor(args: { stackId: string }) {
		super()

		new TestStack(this, args.stackId)
	}
}
