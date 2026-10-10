export const SERVERS = [
  {
    id: 'server-1',
    name: 'Server 01 · Primary',
    url: process.env.BACKEND_URL || 'https://lod-x-mini-973b0448a8cc.herokuapp.com',
    region: 'Primary Cluster',
    enabled: true
  },

  {
    id: 'server-2',
    name: 'Server 02 · Secondary',
    url: process.env.BACKEND_URL_2 || 'https://rcd-mini-server-2.onrender.com',
    region: 'Cluster Node 02',
    enabled: Boolean(process.env.BACKEND_URL_2)
  },

  {
    id: 'server-3',
    name: 'Server 03 · Backup Node',
    url: process.env.BACKEND_URL_3 || 'https://rcd-mini-server-3.herokuapp.com',
    region: 'Cluster Node 03',
    enabled: Boolean(process.env.BACKEND_URL_3)
  }
];

export default { SERVERS };
