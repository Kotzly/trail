import {defineField, defineType} from 'sanity'
import {ComponentIcon} from '@sanity/icons'

export const bentoFeaturesSection = defineType({
  name: 'bentoFeaturesSection',
  title: 'Bento Features',
  type: 'object',
  icon: ComponentIcon,
  fields: [
    defineField({name: 'eyebrow', title: 'Eyebrow', type: 'string'}),
    defineField({name: 'title', title: 'Title', type: 'string', validation: (rule) => rule.required()}),
    defineField({name: 'summary', title: 'Summary', type: 'text', rows: 2}),
    defineField({
      name: 'features',
      title: 'Features',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            defineField({name: 'id', title: 'ID', type: 'string'}),
            defineField({name: 'name', title: 'Name', type: 'string', validation: (rule) => rule.required()}),
            defineField({name: 'description', title: 'Description', type: 'text', rows: 2}),
            defineField({
              name: 'icon',
              title: 'Icon name',
              type: 'string',
              description: 'Lucide icon name (e.g. MousePointerClick, Search, GitBranch)',
            }),
            defineField({name: 'href', title: 'Link', type: 'string'}),
            defineField({name: 'cta', title: 'CTA text', type: 'string'}),
            defineField({
              name: 'className',
              title: 'Grid class',
              type: 'string',
              description: 'Tailwind grid placement class',
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
    select: {title: 'title', eyebrow: 'eyebrow'},
    prepare({title, eyebrow}) {
      return {title: title || 'Bento Features', subtitle: eyebrow}
    },
  },
})
