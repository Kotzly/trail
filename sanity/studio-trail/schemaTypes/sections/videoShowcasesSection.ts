import {defineField, defineType} from 'sanity'
import {PlayIcon} from '@sanity/icons'

export const videoShowcasesSection = defineType({
  name: 'videoShowcasesSection',
  title: 'Video Showcases',
  type: 'object',
  icon: PlayIcon,
  fields: [
    defineField({name: 'title', title: 'Title', type: 'string'}),
    defineField({name: 'summary', title: 'Summary', type: 'text', rows: 2}),
    defineField({
      name: 'items',
      title: 'Video Sections',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            defineField({name: 'eyebrow', title: 'Eyebrow', type: 'string'}),
            defineField({name: 'title', title: 'Title', type: 'string', validation: (rule) => rule.required()}),
            defineField({name: 'description', title: 'Description', type: 'text', rows: 2}),
            defineField({
              name: 'video',
              title: 'Video',
              type: 'file',
              options: {accept: 'video/*'},
              validation: (rule) => rule.required(),
            }),
          ],
          preview: {
            select: {title: 'title', subtitle: 'eyebrow'},
          },
        },
      ],
    }),
  ],
  preview: {
    select: {title: 'title'},
    prepare({title}) {
      return {title: title || 'Video Showcases'}
    },
  },
})
