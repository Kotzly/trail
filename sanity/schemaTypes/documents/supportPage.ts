import {defineField, defineType, defineArrayMember} from 'sanity'
import {HelpCircleIcon} from '@sanity/icons'

const contactChannel = defineArrayMember({
  type: 'object',
  name: 'contactChannel',
  fields: [
    defineField({
      name: 'label',
      title: 'Label',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'description',
      title: 'Description',
      type: 'string',
    }),
    defineField({
      name: 'href',
      title: 'Link',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'icon',
      title: 'Icon',
      type: 'string',
      description: 'Lucide icon name, e.g. "Mail", "MessageCircle", "Send"',
    }),
  ],
  preview: {
    select: {title: 'label', subtitle: 'href'},
  },
})

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
    defineField({
      name: 'contactChannels',
      title: 'Contact Channels',
      type: 'array',
      of: [contactChannel],
    }),
  ],
  preview: {
    prepare() {
      return {title: 'Support Page'}
    },
  },
})
