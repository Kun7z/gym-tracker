import Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().port().default(3000),
  DATABASE_URL: Joi.string().required(),
  JWT_ACCESS_SECRET: Joi.string().min(16).required(),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_SECRET: Joi.string().min(16).required(),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('30d'),
  REFRESH_COOKIE_MAX_AGE_DAYS: Joi.number().default(30),
  CORS_ORIGIN: Joi.string().default('http://localhost:4200'),
  WGER_BASE_URL: Joi.string().uri().allow('').optional(),
  WGER_API_TOKEN: Joi.string().allow('').optional(),
});
