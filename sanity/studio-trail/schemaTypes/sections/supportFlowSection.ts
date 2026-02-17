import {defineField, defineType} from 'sanity'
import {HelpCircleIcon} from '@sanity/icons'

export const supportFlowSection = defineType({
  name: 'supportFlowSection',
  title: 'Support Flow',
  type: 'object',
  icon: HelpCircleIcon,
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      description: 'Optional title (used for Studio preview only — the interactive component renders its own UI)',
    }),
  ],
  preview: {
    select: {title: 'title'},
    prepare({title}) {
      return {title: title || 'Support Flow (interactive)'}
    },
  },
})
