/**
 * COREBLDG SVG Icon System
 * 16x16 viewBox, stroke-based, consistent weight
 */
const ICONS = {
  home:         '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M1 8L8 2l7 6"/><path d="M3 7v7h4v-4h2v4h4V7"/></svg>',
  dashboard:    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1" y="1" width="6" height="6" rx="1"/><rect x="9" y="1" width="6" height="6" rx="1"/><rect x="1" y="9" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/></svg>',
  cases:        '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 3h10a1 1 0 011 1v9a1 1 0 01-1 1H3a1 1 0 01-1-1V4a1 1 0 011-1z"/><path d="M5 3V2a1 1 0 011-1h4a1 1 0 011 1v1"/><line x1="5" y1="7" x2="11" y2="7"/><line x1="5" y1="10" x2="9" y2="10"/></svg>',
  contract:     '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 1H3a1 1 0 00-1 1v12a1 1 0 001 1h10a1 1 0 001-1V6z"/><polyline points="9 1 9 6 14 6"/><line x1="5" y1="9" x2="11" y2="9"/><line x1="5" y1="12" x2="8" y2="12"/></svg>',
  payment:      '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1" y="4" width="14" height="9" rx="1"/><line x1="1" y1="7" x2="15" y2="7"/><circle cx="4.5" cy="10.5" r="1"/></svg>',
  crm:          '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="5" r="3"/><path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6"/></svg>',
  matching:     '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="5" cy="8" r="3"/><circle cx="11" cy="8" r="3"/><line x1="8" y1="5" x2="8" y2="11"/></svg>',
  account:      '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="6" r="3"/><path d="M1 14c0-3.9 3.1-7 7-7s7 3.1 7 7"/></svg>',
  faq:          '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="7"/><path d="M6 6c0-1.1.9-2 2-2s2 .9 2 2c0 1.5-2 2-2 3"/><circle cx="8" cy="12" r=".5" fill="currentColor"/></svg>',
  pipeline:     '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1" y="2" width="3" height="12" rx="1"/><rect x="6" y="4" width="3" height="10" rx="1"/><rect x="11" y="6" width="3" height="8" rx="1"/></svg>',
  itsetsu:      '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1" y="2" width="14" height="11" rx="1"/><path d="M5 15h6"/><line x1="8" y1="13" x2="8" y2="15"/><circle cx="8" cy="7" r="2"/></svg>',
  finance:      '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 1v14M3 4h10M2 8h12M3 12h10"/></svg>',
  users:        '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="6" cy="5" r="2.5"/><path d="M1 13c0-2.8 2.2-5 5-5s5 2.2 5 5"/><circle cx="12" cy="5" r="2"/><path d="M12 10c1.7.3 3 1.8 3 3.5"/></svg>',
  ag_mgmt:      '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="8,1 10,6 15,6 11,9 13,14 8,11 3,14 5,9 1,6 6,6"/></svg>',
  training:     '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 1L1 5l7 4 7-4-7-4z"/><path d="M1 9l7 4 7-4"/></svg>',
  notification: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 1a5 5 0 015 5v3l1 2H2l1-2V6a5 5 0 015-5z"/><path d="M6 13a2 2 0 004 0"/></svg>',
  exec_dash:    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="1,11 5,7 8,9 12,4 15,6"/><line x1="1" y1="15" x2="15" y2="15"/></svg>',
  settings:     '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="2.5"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.5 1.5M11.5 11.5L13 13M13 3l-1.5 1.5M4.5 11.5L3 13"/></svg>',
  instant_pay:  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="9,1 6,8 10,8 7,15"/></svg>',
  rank:         '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5" y="6" width="3" height="8"/><rect x="10" y="3" width="3" height="11"/><rect x="0" y="9" width="3" height="5"/></svg>',
  portal:       '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="7"/><ellipse cx="8" cy="8" rx="3" ry="7"/><line x1="1" y1="8" x2="15" y2="8"/></svg>',
  progress:     '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="7"/><polyline points="8,4 8,8 11,10"/></svg>',
  search:       '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="7" cy="7" r="5"/><line x1="11" y1="11" x2="15" y2="15"/></svg>',
  chevron:      '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="4,2 12,8 4,14"/></svg>',
};

function icon(name, size) {
  var sz = size || 16;
  var svg = ICONS[name] || ICONS.dashboard;
  return svg.replace('<svg ', '<svg width="'+sz+'" height="'+sz+'" ');
}

window.ICONS = ICONS;
window.icon = icon;
