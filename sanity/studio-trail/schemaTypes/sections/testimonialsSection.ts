import {defineField, defineType} from 'sanity'
import {CommentIcon} from '@sanity/icons'

export const testimonialsSection = defineType({
  name: 'testimonialsSection',
  title: 'Testimonials',
  type: 'object',
  icon: CommentIcon,
  fields: [
    defineField({name: 'eyebrow', title: 'Eyebrow', type: 'string'}),
    defineField({name: 'title', title: 'Title', type: 'string', validation: (rule) => rule.required()}),
    defineField({name: 'summary', title: 'Summary', type: 'text', rows: 2}),
    defineField({
      name: 'items',
      title: 'Testimonials',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            defineField({name: 'name', title: 'Name', type: 'string', validation: (rule) => rule.required()}),
            defineField({name: 'role', title: 'Role', type: 'string'}),
            defineField({name: 'quote', title: 'Quote', type: 'text', rows: 3, validation: (rule) => rule.required()}),
            defineField({name: 'image', title: 'Avatar', type: 'image', options: {hotspot: true}}),
          ],
          preview: {
            select: {title: 'name', subtitle: 'role', media: 'image'},
          },
        },
      ],
    }),
  ],
  preview: {
    select: {title: 'title', eyebrow: 'eyebrow'},
    prepare({title, eyebrow}) {
      return {title: title || 'Testimonials', subtitle: eyebrow}
    },
  },
})
