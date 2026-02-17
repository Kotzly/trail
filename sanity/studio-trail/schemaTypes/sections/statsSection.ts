import {defineField, defineType} from 'sanity'
import {BarChartIcon} from '@sanity/icons'

export const statsSection = defineType({
  name: 'statsSection',
  title: 'Stats',
  type: 'object',
  icon: BarChartIcon,
  fields: [
    defineField({name: 'title', title: 'Title', type: 'string'}),
    defineField({
      name: 'stats',
      title: 'Stats',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            defineField({name: 'value', title: 'Value', type: 'string', validation: (rule) => rule.required()}),
            defineField({name: 'label', title: 'Label', type: 'string', validation: (rule) => rule.required()}),
          ],
          preview: {
            select: {title: 'value', subtitle: 'label'},
          },
        },
      ],
    }),
  ],
  preview: {
    select: {title: 'title'},
    prepare({title}) {
      return {title: title || 'Stats'}
    },
  },
})
