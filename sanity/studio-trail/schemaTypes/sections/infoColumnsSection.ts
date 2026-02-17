import {defineField, defineType} from 'sanity'
import {InlineElementIcon} from '@sanity/icons'

export const infoColumnsSection = defineType({
  name: 'infoColumnsSection',
  title: 'Info Columns',
  type: 'object',
  icon: InlineElementIcon,
  fields: [
    defineField({name: 'title', title: 'Title', type: 'string'}),
    defineField({
      name: 'columns',
      title: 'Columns',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            defineField({name: 'title', title: 'Title', type: 'string', validation: (rule) => rule.required()}),
            defineField({
              name: 'items',
              title: 'Items',
              type: 'array',
              of: [{type: 'string'}],
            }),
          ],
          preview: {
            select: {title: 'title'},
          },
        },
      ],
    }),
  ],
  preview: {
    select: {title: 'title'},
    prepare({title}) {
      return {title: title || 'Info Columns'}
    },
  },
})
