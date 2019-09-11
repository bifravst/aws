import { TestApp } from './apps/Test'
import { stackId } from './stacks/Test'

const STACK_ID = process.env.STACK_ID || 'bifravst'

new TestApp({
	stackId: stackId({ bifravstStackName: STACK_ID }),
}).synth()
