import {defineField, defineType} from 'sanity'
import {InfoOutlineIcon} from '@sanity/icons'

export const supportOptionsSection = defineType({
  name: 'supportOptionsSection',
  title: 'Support Options',
  type: 'object',
  icon: InfoOutlineIcon,
  fields: [
    defineField({name: 'title', title: 'Title', type: 'string'}),
    defineField({
      name: 'options',
      title: 'Options',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            defineField({name: 'title', title: 'Title', type: 'string', validation: (rule) => rule.required()}),
            defineField({name: 'description', title: 'Description', type: 'text', rows: 2}),
            defineField({
              name: 'icon',
              title: 'Icon name',
              type: 'string',
              description: 'Lucide icon name',
            }),
            defineField({name: 'action', title: 'Action Label', type: 'string'}),
            defineField({name: 'href', title: 'Action URL', type: 'string'}),
            defineField({name: 'primary', title: 'Primary style', type: 'boolean', initialValue: false}),
          ],
          preview: {
            select: {title: 'title', subtitle: 'description'},
          },
        },
      ],
    }),
  ],
  preview: {
    prepare() {
      return {title: 'Support Options'}
    },
  },
})
