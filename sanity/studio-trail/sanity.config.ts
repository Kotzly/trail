import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'
import {visionTool} from '@sanity/vision'
import {schemaTypes} from './schemaTypes'
import {CogIcon, DocumentTextIcon, DocumentIcon, StarIcon} from '@sanity/icons'
import type {StructureBuilder} from 'sanity/structure'

const singletonTypes = new Set(['siteSettings', 'landingPage'])

function structure(S: StructureBuilder) {
  return S.list()
    .title('Content')
    .items([
      S.listItem()
        .title('Site Settings')
        .icon(CogIcon)
        .child(S.document().schemaType('siteSettings').documentId('siteSettings')),
      S.listItem()
        .title('Landing Page')
        .icon(StarIcon)
        .child(
          S.document()
            .schemaType('landingPage')
            .documentId('042dbb5a-4a60-4cde-8076-97f3e1293d36'),
        ),
      S.divider(),
      S.listItem()
        .title('Content Pages')
        .icon(DocumentTextIcon)
        .child(S.documentTypeList('page').title('Content Pages')),
      S.listItem()
        .title('Legal Pages')
        .icon(DocumentIcon)
        .child(S.documentTypeList('legalPage').title('Legal Pages')),
    ])
}

export default defineConfig({
  name: 'default',
  title: 'Trail',

  projectId: 'qejrh1jd',
  dataset: 'production',

  plugins: [
    structureTool({structure}),
    visionTool(),
  ],

  schema: {
    types: schemaTypes,
    templates: (templates) => templates.filter(({schemaType}) => !singletonTypes.has(schemaType)),
  },

  document: {
    actions: (input, context) =>
      singletonTypes.has(context.schemaType)
        ? input.filter(({action}) => action && ['publish', 'discardChanges', 'restore'].includes(action))
        : input,
  },
})
