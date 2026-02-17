import {defineField, defineType} from 'sanity'
import {BookIcon} from '@sanity/icons'

export const storySection = defineType({
  name: 'storySection',
  title: 'Story',
  type: 'object',
  icon: BookIcon,
  fields: [
    defineField({name: 'title', title: 'Title', type: 'string', validation: (rule) => rule.required()}),
    defineField({
      name: 'body',
      title: 'Body',
      type: 'array',
      of: [{type: 'block'}],
    }),
  ],
  preview: {
    select: {title: 'title'},
    prepare({title}) {
      return {title: title || 'Story'}
    },
  },
})
