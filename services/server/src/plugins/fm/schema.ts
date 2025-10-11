const headersSchema = {
  type: 'object',
  properties: {
    'x-lookup': { type: 'string' }
  },
  required: ['x-lookup']
}

const querystringSchema = {
  type: 'object',
  properties: {
    path: { type: 'string' },
  },
  required: ['path']
}

export default {
  headers: headersSchema,
  querystring: querystringSchema
}
