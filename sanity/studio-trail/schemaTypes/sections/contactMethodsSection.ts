import {defineField, defineType} from 'sanity'
import {EnvelopeIcon} from '@sanity/icons'

export const contactMethodsSection = defineType({
  name: 'contactMethodsSection',
  title: 'Contact Methods',
  type: 'object',
  icon: EnvelopeIcon,
  fields: [
    defineField({name: 'title', title: 'Title', type: 'string'}),
    defineField({
      name: 'methods',
      title: 'Methods',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            defineField({name: 'title', title: 'Title', type: 'string', validation: (rule) => rule.required()}),
            defineField({name: 'email', title: 'Email', type: 'string'}),
            defineField({name: 'description', title: 'Description', type: 'text', rows: 2}),
            defineField({
              name: 'icon',
              title: 'Icon name',
              type: 'string',
              description: 'Lucide icon name (e.g. Mail, HelpCircle, MessageSquare)',
            }),
          ],
          preview: {
            select: {title: 'title', subtitle: 'email'},
          },
        },
      ],
    }),
  ],
  preview: {
    prepare() {
      return {title: 'Contact Methods'}
    },
  },
})
