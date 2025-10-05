const headersSchema = {
  type: 'object',
  properties: {
    'x-lookup': { type: 'string' }
  },
  required: ['x-lookup']
}

export default {
  headers: headersSchema
}
