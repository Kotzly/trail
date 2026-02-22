import {defineField, defineType} from 'sanity'
import {HelpCircleIcon} from '@sanity/icons'

export const supportPage = defineType({
  name: 'supportPage',
  title: 'Support Page',
  type: 'document',
  icon: HelpCircleIcon,
  fields: [
    defineField({
      name: 'title',
      title: 'Page Title',
      type: 'string',
      initialValue: 'Support',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'description',
      title: 'Description',
      type: 'text',
      rows: 2,
    }),
    defineField({
      name: 'seo',
      title: 'SEO',
      type: 'seo',
    }),
    defineField({
      name: 'statusPageUrl',
      title: 'Status Page URL',
      type: 'url',
      description: 'Link to external status page (e.g. BetterStack, Instatus)',
    }),
    defineField({
      name: 'statusLabel',
      title: 'Status Label',
      type: 'string',
      initialValue: 'All systems operational',
    }),
    defineField({
      name: 'contactEmail',
      title: 'Contact Email',
      type: 'string',
      initialValue: 'support@gettrail.net',
    }),
  ],
  preview: {
    prepare() {
      return {title: 'Support Page'}
    },
  },
})
