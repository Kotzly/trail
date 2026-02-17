import {defineField, defineType} from 'sanity'
import {DownloadIcon} from '@sanity/icons'

export const browserCardsSection = defineType({
  name: 'browserCardsSection',
  title: 'Browser Cards',
  type: 'object',
  icon: DownloadIcon,
  fields: [
    defineField({name: 'eyebrow', title: 'Eyebrow', type: 'string'}),
    defineField({name: 'title', title: 'Title', type: 'string', validation: (rule) => rule.required()}),
    defineField({name: 'subtitle', title: 'Subtitle', type: 'text', rows: 2}),
    defineField({
      name: 'browsers',
      title: 'Browsers',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            defineField({name: 'id', title: 'ID', type: 'string'}),
            defineField({name: 'name', title: 'Name', type: 'string', validation: (rule) => rule.required()}),
            defineField({
              name: 'icon',
              title: 'Icon name',
              type: 'string',
              description: 'Icon identifier (e.g. chrome, brave, edge, firefox, safari)',
            }),
            defineField({
              name: 'status',
              title: 'Status',
              type: 'string',
              options: {
                list: [
                  {title: 'Available', value: 'available'},
                  {title: 'Coming Soon', value: 'coming-soon'},
                ],
              },
            }),
            defineField({name: 'color', title: 'Brand Color', type: 'string', description: 'Hex color e.g. #4285F4'}),
            defineField({name: 'storeUrl', title: 'Store URL', type: 'url'}),
          ],
          preview: {
            select: {title: 'name', subtitle: 'status'},
          },
        },
      ],
    }),
  ],
  preview: {
    select: {title: 'title'},
    prepare({title}) {
      return {title: title || 'Browser Cards'}
    },
  },
})
