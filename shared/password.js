export const PASSWORD_MIN_LENGTH = 6
export const PASSWORD_MAX_LENGTH = 20
export const PASSWORD_MESSAGE = 'A senha deve ter entre 6 e 20 caracteres.'
// Match the length used by HTML minlength/maxlength and Zod.
export const validPassword = (value) => typeof value === 'string' &&
  value.length >= PASSWORD_MIN_LENGTH && value.length <= PASSWORD_MAX_LENGTH
