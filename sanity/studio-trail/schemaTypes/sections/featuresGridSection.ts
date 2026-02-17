import {defineField, defineType} from 'sanity'
import {BlockElementIcon} from '@sanity/icons'

export const featuresGridSection = defineType({
  name: 'featuresGridSection',
  title: 'Features Grid',
  type: 'object',
  icon: BlockElementIcon,
  fields: [
    defineField({name: 'eyebrow', title: 'Eyebrow', type: 'string'}),
    defineField({name: 'title', title: 'Title', type: 'string', validation: (rule) => rule.required()}),
    defineField({name: 'subtitle', title: 'Subtitle', type: 'text', rows: 2}),
    defineField({
      name: 'features',
      title: 'Features',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            defineField({name: 'name', title: 'Name', type: 'string', validation: (rule) => rule.required()}),
            defineField({name: 'description', title: 'Description', type: 'text', rows: 2}),
            defineField({
              name: 'icon',
              title: 'Icon name',
              type: 'string',
              description: 'Lucide icon name',
            }),
          ],
          preview: {
            select: {title: 'name', subtitle: 'description'},
          },
        },
      ],
    }),
  ],
  preview: {
    select: {title: 'title'},
    prepare({title}) {
      return {title: title || 'Features Grid'}
    },
  },
})
