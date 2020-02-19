import * as E from 'fp-ts/lib/Either'
import { ErrorInfo, ErrorType } from '../ErrorInfo'
import * as Ajv from 'ajv'

export const validate = (schema: Ajv.ValidateFunction) => <T>(
	value: T,
) => (): E.Either<ErrorInfo, T> => {
	const valid = schema(value)
	if (!valid) {
		return E.left({
			type: ErrorType.BadRequest,
			message: 'Validation failed!',
		})
	}
	return E.right(value)
}
