import {defineField, defineType} from 'sanity'

export const ctaBlock = defineType({
  name: 'ctaBlock',
  title: 'Call to Action',
  type: 'object',
  fields: [
    defineField({
      name: 'text',
      title: 'Button text',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'href',
      title: 'URL',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'variant',
      title: 'Style',
      type: 'string',
      options: {
        list: [
          {title: 'Primary', value: 'primary'},
          {title: 'Secondary', value: 'secondary'},
          {title: 'Ghost', value: 'ghost'},
        ],
      },
      initialValue: 'primary',
    }),
  ],
  preview: {
    select: {title: 'text', subtitle: 'href'},
  },
})
