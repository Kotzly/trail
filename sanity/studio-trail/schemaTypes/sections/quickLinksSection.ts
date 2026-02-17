import {defineField, defineType} from 'sanity'
import {LinkIcon} from '@sanity/icons'

export const quickLinksSection = defineType({
  name: 'quickLinksSection',
  title: 'Quick Links',
  type: 'object',
  icon: LinkIcon,
  fields: [
    defineField({name: 'title', title: 'Title', type: 'string'}),
    defineField({
      name: 'links',
      title: 'Links',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            defineField({name: 'title', title: 'Title', type: 'string', validation: (rule) => rule.required()}),
            defineField({name: 'description', title: 'Description', type: 'string'}),
            defineField({name: 'href', title: 'URL', type: 'string', validation: (rule) => rule.required()}),
            defineField({name: 'icon', title: 'Icon name', type: 'string', description: 'Lucide icon name'}),
          ],
          preview: {
            select: {title: 'title', subtitle: 'href'},
          },
        },
      ],
    }),
  ],
  preview: {
    select: {title: 'title'},
    prepare({title}) {
      return {title: title || 'Quick Links'}
    },
  },
})
