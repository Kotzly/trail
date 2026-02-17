import {defineField, defineType} from 'sanity'
import {CalendarIcon} from '@sanity/icons'

export const timelineSection = defineType({
  name: 'timelineSection',
  title: 'Timeline',
  type: 'object',
  icon: CalendarIcon,
  fields: [
    defineField({name: 'title', title: 'Title', type: 'string', validation: (rule) => rule.required()}),
    defineField({name: 'subtitle', title: 'Subtitle', type: 'text', rows: 2}),
    defineField({
      name: 'items',
      title: 'Timeline Items',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            defineField({name: 'year', title: 'Year / Label', type: 'string', validation: (rule) => rule.required()}),
            defineField({name: 'heading', title: 'Heading', type: 'string'}),
            defineField({name: 'description', title: 'Description', type: 'text', rows: 3}),
            defineField({
              name: 'highlights',
              title: 'Highlights',
              type: 'array',
              of: [{type: 'string'}],
            }),
            defineField({name: 'image', title: 'Image', type: 'image', options: {hotspot: true}}),
            defineField({
              name: 'status',
              title: 'Status',
              type: 'string',
              options: {
                list: [
                  {title: 'Completed', value: 'completed'},
                  {title: 'In Progress', value: 'in_progress'},
                  {title: 'Planned', value: 'planned'},
                  {title: 'Future', value: 'future'},
                ],
              },
            }),
          ],
          preview: {
            select: {title: 'year', subtitle: 'heading'},
          },
        },
      ],
    }),
  ],
  preview: {
    select: {title: 'title'},
    prepare({title}) {
      return {title: title || 'Timeline'}
    },
  },
})
