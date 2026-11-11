// Synthetic page/actor props only. All editor state/hooks, TipTap and operation journals are actual captured source.
import React from 'react';
import {createRoot} from 'react-dom/client';
import PageEditor from '@/components/PageEditor';

const h = window.__m20PageActor;
const page = {
  id: '11111111-1111-4111-8111-111111111111',
  updated_at: '2026-10-30T12:34:56.123456+00:00',
  title: 'Synthetic original page', excerpt: 'Synthetic original excerpt', slug: 'synthetic-page',
  content_html: '<p>Synthetic original paragraph.</p>',
  content_json: {type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Synthetic original paragraph.'}]}]},
  status: 'draft', seo_title: '', seo_description: '', canonical_url: null, allow_indexing: true,
};
h.reactVersion = React.version;
createRoot(document.getElementById('root')).render(<PageEditor page={page}
  actorId="22222222-2222-4222-8222-222222222222" publicSiteUrl="https://public.invalid"
  catalogContext={{q:'Synthetic context',status:'draft',page:2,revisionPage:3}} />);
h.entryLoaded = true;
