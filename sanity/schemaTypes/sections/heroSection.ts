import {defineField, defineType} from 'sanity'
import {StarIcon} from '@sanity/icons'

export const heroSection = defineType({
  name: 'heroSection',
  title: 'Hero',
  type: 'object',
  icon: StarIcon,
  fields: [
    defineField({name: 'eyebrow', title: 'Eyebrow', type: 'string'}),
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'rotatingWords',
      title: 'Rotating Words',
      type: 'array',
      of: [{type: 'string'}],
      description: 'Animated words that cycle after the title',
    }),
    defineField({name: 'description', title: 'Description', type: 'text', rows: 3}),
    defineField({
      name: 'ctas',
      title: 'Call-to-action Buttons',
      type: 'array',
      of: [{type: 'ctaBlock'}],
    }),
    defineField({
      name: 'video',
      title: 'Video',
      type: 'file',
      options: {accept: 'video/*'},
    }),
    defineField({
      name: 'poster',
      title: 'Video Poster',
      type: 'image',
      options: {hotspot: true},
    }),
  ],
  preview: {
    select: {title: 'title', eyebrow: 'eyebrow'},
    prepare({title, eyebrow}) {
      return {title: title || 'Hero', subtitle: eyebrow}
    },
  },
})
