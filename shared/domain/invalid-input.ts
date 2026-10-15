// A request parameter the user can fix; the API answers 400 with this code and message.
export class InvalidInput extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'InvalidInput'
    this.code = code
  }
}
