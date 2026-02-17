import {defineField, defineType} from 'sanity'
import {ThListIcon} from '@sanity/icons'

export const comparisonTableSection = defineType({
  name: 'comparisonTableSection',
  title: 'Comparison Table',
  type: 'object',
  icon: ThListIcon,
  fields: [
    defineField({name: 'title', title: 'Title', type: 'string'}),
    defineField({
      name: 'columns',
      title: 'Column Headers',
      type: 'array',
      of: [{type: 'string'}],
      description: 'Column labels (e.g. "Free", "Pro", "Teams")',
    }),
    defineField({
      name: 'rows',
      title: 'Rows',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            defineField({name: 'feature', title: 'Feature', type: 'string', validation: (rule) => rule.required()}),
            defineField({
              name: 'values',
              title: 'Values',
              type: 'array',
              of: [{type: 'string'}],
              description: 'One value per column',
            }),
          ],
          preview: {
            select: {title: 'feature'},
          },
        },
      ],
    }),
  ],
  preview: {
    select: {title: 'title'},
    prepare({title}) {
      return {title: title || 'Comparison Table'}
    },
  },
})
