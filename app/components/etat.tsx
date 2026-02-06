'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { Box, Typography, List, ListItem, ListItemText, TextField, IconButton, Button, Tooltip, Chip, MenuItem, Select, FormControl, InputLabel } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import SortByAlphaIcon from '@mui/icons-material/SortByAlpha';
import TagIcon from '@mui/icons-material/Tag';

interface Order {
  No: string;
  Document_Type: string;
  Sell_to_Customer_No?: string;
  Buy_from_Vendor_No?: string;
  Requested_Delivery_Date?: string;
  PromisedDeliveryHours?: string;
}

const fetchOrders = async (): Promise<Order[]> => {
  try {
    const salesResponse = await fetch('/api/salesOrders');
    const salesData = await salesResponse.json();

    const currentUser = localStorage.getItem('userIdentifier');

    const filteredSales = salesData.value.filter(
      (order: any) =>
        order.Assigned_Driver_No === currentUser &&
        order.status === 'Open'
    );

    return filteredSales.map((order: any) => ({
      No: order.No,
      Document_Type: order.Document_Type,
      Sell_to_Customer_No: order.Sell_to_Customer_No,
      Requested_Delivery_Date: order.Requested_Delivery_Date,
      PromisedDeliveryHours: order.PromisedDeliveryHours,
    }));
  } catch (error) {
    console.error('Error fetching orders:', error);
    return [];
  }
};

const Etat = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [delivered, setDelivered] = useState<Order[]>([]);
  const [notDelivered, setNotDelivered] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [timeFilter, setTimeFilter] = useState<'all' | 'morning' | 'afternoon'>('all');
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'time' | 'client' | 'no'>('time');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const currentDate = new Date().toISOString().split('T')[0]; // Dynamic current date

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchOrders()
      .then((data) => {
        const todayOrders = data.filter(
          (order) =>
            order.Requested_Delivery_Date &&
            order.Requested_Delivery_Date.split('T')[0] === currentDate
        );
        setOrders(todayOrders);
        const saved = localStorage.getItem(`etat_board_${currentDate}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          const byNo = new Map(todayOrders.map(o => [o.No, o] as const));
          setDelivered((parsed.delivered || []).map((x: any) => byNo.get(x.No)).filter(Boolean) as Order[]);
          setNotDelivered((parsed.notDelivered || []).map((x: any) => byNo.get(x.No)).filter(Boolean) as Order[]);
        } else {
          setDelivered([]);
          setNotDelivered([]);
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Erreur chargement'))
      .finally(() => setLoading(false));
  }, [currentDate]);

  useEffect(() => {
    localStorage.setItem(
      `etat_board_${currentDate}`,
      JSON.stringify({ delivered, notDelivered })
    );
  }, [delivered, notDelivered, currentDate]);

  const handleDragStart = (e: React.DragEvent, order: Order) => {
    e.dataTransfer.setData('text', JSON.stringify(order));
  };

  const basePool = useMemo(() => {
    const placed = new Set<string>([...delivered, ...notDelivered].map(o => o.No));
    return orders.filter(o => !placed.has(o.No));
  }, [orders, delivered, notDelivered]);

  const clients = useMemo(() => {
    const set = new Set<string>();
    orders.forEach(o => { if (o.Sell_to_Customer_No) set.add(o.Sell_to_Customer_No); });
    return ['all', ...Array.from(set.values()).sort()];
  }, [orders]);

  const passTimeFilter = (o: Order) => {
    if (!o.PromisedDeliveryHours) return true;
    const hour = parseInt(o.PromisedDeliveryHours.slice(0,2) || '0', 10);
    if (timeFilter === 'morning') return hour <= 12;
    if (timeFilter === 'afternoon') return hour > 12;
    return true;
  };

  const applySort = (arr: Order[]) => {
    const sorted = [...arr].sort((a,b) => {
      const av = sortBy === 'time' ? (a.PromisedDeliveryHours || '') : sortBy === 'client' ? (a.Sell_to_Customer_No || '') : a.No;
      const bv = sortBy === 'time' ? (b.PromisedDeliveryHours || '') : sortBy === 'client' ? (b.Sell_to_Customer_No || '') : b.No;
      return av.localeCompare(bv);
    });
    return sortDir === 'asc' ? sorted : sorted.reverse();
  };

  const filteredPool = useMemo(() => {
    const q = query.trim().toLowerCase();
    let pool = basePool.filter(o => passTimeFilter(o));
    if (clientFilter !== 'all') pool = pool.filter(o => o.Sell_to_Customer_No === clientFilter);
    if (q) pool = pool.filter(o => o.No.toLowerCase().includes(q) || (o.Sell_to_Customer_No || '').toLowerCase().includes(q));
    return applySort(pool);
  }, [basePool, query, timeFilter, clientFilter, sortBy, sortDir]);

  const exportCSV = () => {
    const headers = ['No','Client','Date','Heure','Etat'];
    const rows: string[][] = [
      ...delivered.map(o => [o.No, o.Sell_to_Customer_No || '', o.Requested_Delivery_Date || '', o.PromisedDeliveryHours || '', 'Livré']),
      ...notDelivered.map(o => [o.No, o.Sell_to_Customer_No || '', o.Requested_Delivery_Date || '', o.PromisedDeliveryHours || '', 'Non livré']),
      ...basePool.map(o => [o.No, o.Sell_to_Customer_No || '', o.Requested_Delivery_Date || '', o.PromisedDeliveryHours || '', 'A planifier']),
    ];
    const csv = [headers.join(','), ...rows.map(r => r.map(x => '"' + String(x).replace(/"/g,'""') + '"').join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `etat_${currentDate}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, target: 'orders' | 'delivered' | 'not-delivered') => {
    e.preventDefault();
    const orderData = JSON.parse(e.dataTransfer.getData('text'));

    if (!orderData.No) {
      console.error('Invalid order data:', orderData);
      return;
    }

    const draggedOrder = orders.find((o) => o.No === orderData.No) || 
                        delivered.find((o) => o.No === orderData.No) || 
                        notDelivered.find((o) => o.No === orderData.No);
    if (!draggedOrder) return;

    // Remove from all sources before adding to target
    setOrders((prev) => prev.filter((o) => o.No !== draggedOrder.No));
    setDelivered((prev) => prev.filter((o) => o.No !== draggedOrder.No));
    setNotDelivered((prev) => prev.filter((o) => o.No !== draggedOrder.No));

    // Add to the target based on drop location
    if (target === 'delivered') {
      setDelivered((prev) => [...prev, draggedOrder]);
    } else if (target === 'not-delivered') {
      setNotDelivered((prev) => [...prev, draggedOrder]);
    } else if (target === 'orders') {
      setOrders((prev) => [...prev, draggedOrder]);
    }
  };

  return (
    <Box sx={{ p: { xs: 1, md: 4 }, display: 'flex', flexDirection: 'column', bgcolor: '#f8fafc', height: '100vh', overflow: 'auto' }}>
      {/* Display Current Date */}
      <Typography variant="h5" sx={{ mb: 2, textAlign: 'center' }}>
        {new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
      </Typography>

      <Box sx={{ position: 'sticky', top: 0, zIndex: 5, background: '#f8fafc', py: 1, mb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%', maxWidth: '100%', px: { xs: 1, md: 2 } }}>
        <TextField size="small" placeholder="Rechercher N° ou Client" value={query} onChange={(e) => setQuery(e.target.value)} sx={{ flex: 1, bgcolor: 'white', borderRadius: 1 }} />
        <Chip label={`A planifier: ${basePool.length}`} color="default" variant="outlined" />
        <Chip label={`Livré: ${delivered.length}`} color="success" variant="outlined" />
        <Chip label={`Non livré: ${notDelivered.length}`} color="error" variant="outlined" />
        <Tooltip title="Rafraîchir">
          <IconButton onClick={() => { localStorage.removeItem(`etat_board_${currentDate}`); window.location.reload(); }}><RefreshIcon /></IconButton>
        </Tooltip>
        <Tooltip title="Exporter CSV">
          <IconButton onClick={exportCSV}><FileDownloadIcon /></IconButton>
        </Tooltip>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%', maxWidth: '100%', px: { xs: 1, md: 2 }, mt: 1 }}>
          <Chip label="Tous" color={timeFilter==='all'?'primary':'default'} onClick={()=>setTimeFilter('all')} size="small" />
          <Chip label="Matin (≤12h)" color={timeFilter==='morning'?'primary':'default'} onClick={()=>setTimeFilter('morning')} size="small" />
          <Chip label="Après-midi (>12h)" color={timeFilter==='afternoon'?'primary':'default'} onClick={()=>setTimeFilter('afternoon')} size="small" />
          <FormControl size="small" sx={{ minWidth: 180, ml: 1 }}>
            <InputLabel id="client-filter-label">Client</InputLabel>
            <Select labelId="client-filter-label" label="Client" value={clientFilter} onChange={(e)=>setClientFilter(e.target.value)}>
              {clients.map(c => (<MenuItem key={c} value={c}>{c==='all'?'Tous les clients':c}</MenuItem>))}
            </Select>
          </FormControl>
          <Box sx={{ flex: 1 }} />
          <Tooltip title={`Trier par heure (${sortDir})`}>
            <IconButton onClick={()=>{ setSortBy('time'); setSortDir(d=> d==='asc'?'desc':'asc'); }}><AccessTimeIcon fontSize="small" /></IconButton>
          </Tooltip>
          <Tooltip title={`Trier par client (${sortDir})`}>
            <IconButton onClick={()=>{ setSortBy('client'); setSortDir(d=> d==='asc'?'desc':'asc'); }}><SortByAlphaIcon fontSize="small" /></IconButton>
          </Tooltip>
          <Tooltip title={`Trier par N° (${sortDir})`}>
            <IconButton onClick={()=>{ setSortBy('no'); setSortDir(d=> d==='asc'?'desc':'asc'); }}><TagIcon fontSize="small" /></IconButton>
          </Tooltip>
        </Box>
      </Box>

      {loading && (
        <Box sx={{ textAlign: 'center', color: 'text.secondary', mb: 2 }}>Chargement…</Box>
      )}
      {error && (
        <Box sx={{ textAlign: 'center', color: 'error.main', mb: 2 }}>{error}</Box>
      )}

      {/* Main Content (Sidebar + Columns) */}
      <Box
        sx={{
          display: 'flex',
          gap: 2,
          flex: 1,
          minHeight: 0,
          justifyContent: 'stretch',
          width: '100%',
          px: { xs: 1, md: 2 },
          flexDirection: { xs: 'column', md: 'row' },
          alignItems: 'stretch',
        }}
      >
        {/* Sidebar with Orders (recreated) */}
        <Box
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, 'orders')}
          sx={{
            width: { xs: '100%', md: 180, lg: 220 },
            minWidth: { xs: '100%', md: 180, lg: 220 },
            background: '#ffffff',
            borderRadius: 2,
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            p: 2,
            display: 'flex',
            flexDirection: 'column',
            color: 'black',
            mb: { xs: 2, md: 0 },
            position: { md: 'sticky' },
            top: { md: 72 },
            maxHeight: { md: 'calc(100vh - 72px)' },
            overflowY: { md: 'auto' },
          }}
        >
          <Typography variant="h6" sx={{ color: 'blue.900', mb: 1 }}>
            Numéro de commande
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', mb: 1 }}>
            Glissez vers une colonne pour mettre à jour l'état
          </Typography>
          <Box sx={{ flex: '1 1 auto', minHeight: 0, overflow: 'hidden', pr: 2 }}>
            <List dense>
              {filteredPool
                .filter((o) => o.Sell_to_Customer_No)
                .map((order, idx) => (
                  <ListItem
                    key={order.No}
                    draggable
                    onDragStart={(e) => handleDragStart(e, order)}
                    sx={{
                      bgcolor: idx % 2 === 0 ? '#f9f9f9' : '#fff',
                      borderBottom: '1px solid #e0e0e0',
                      cursor: 'move',
                    }}
                  >
                    <ListItemText
                      primary={`#${order.No}`}
                      secondary={
                        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
                          <Box
                            component="span"
                            sx={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              bgcolor: (() => {
                                const nowH = new Date().getHours();
                                const h = parseInt(order.PromisedDeliveryHours?.slice(0, 2) || '0', 10);
                                if (!order.PromisedDeliveryHours) return '#94a3b8';
                                if (h < nowH) return '#ef4444';
                                if (h === nowH) return '#f59e0b';
                                return '#10b981';
                              })(),
                            }}
                          />
                          <span>
                            {`${order.Sell_to_Customer_No || ''}${order.PromisedDeliveryHours ? ' • ' + order.PromisedDeliveryHours : ''}`}
                          </span>
                        </Box>
                      }
                    />
                    <Tooltip title="Ouvrir">
                      <IconButton
                        size="small"
                        onClick={() => window.open(`/commandes?order=${encodeURIComponent(order.No)}`, '_blank')}
                      >
                        <OpenInNewIcon fontSize="inherit" />
                      </IconButton>
                    </Tooltip>
                  </ListItem>
                ))}
            </List>
          </Box>
        </Box>

        {/* Status Table */}
        <Box
          sx={{
            border: '1px solid #e0e0e0',
            borderRadius: 2,
            background: '#ffffff',
            height: 'auto',
            display: 'grid',
            gridTemplateRows: 'auto 1fr',
            gridTemplateColumns: { xs: '1fr 1fr', sm: '1fr 1fr', md: '1fr 1fr', lg: '1fr 1fr', xl: 'minmax(520px, 1fr) minmax(520px, 1fr)' },
            columnGap: { xs: 1, md: 2 },
            overflowX: 'hidden',
            overflowY: 'visible',
            flex: 1,
            width: '100%',
          }}
        >
          {/* Sticky header inside table */}
          <Box sx={{ gridColumn: '1 / span 2', position: { xs: 'static', md: 'sticky' }, top: 0, zIndex: 3, display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
            <Box sx={{ bgcolor: '#16a34a', color: '#fff', p: { xs: 0.5, md: 1 }, textAlign: 'center', borderRight: '1px solid #e0e0e0' }}>
              Livré ({delivered.length})
            </Box>
            <Box sx={{ bgcolor: '#ef4444', color: '#fff', p: { xs: 0.5, md: 1 }, textAlign: 'center' }}>
              Non livré ({notDelivered.length})
            </Box>
          </Box>
          {/* Delivered column */}
          <Box
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, 'delivered')}
            sx={{ borderRight: '1px solid #e0e0e0', p: { xs: 0.5, md: 1 }, overflowY: 'visible', minWidth: 0 }}
          >
            <List dense>
              {delivered.map((order, index) => (
                <ListItem
                  key={order.No}
                  draggable
                  onDragStart={(e) => handleDragStart(e, order)}
                  sx={{
                    bgcolor: index % 2 === 0 ? '#f9f9f9' : '#fff',
                    borderBottom: '1px solid #e0e0e0',
                    cursor: 'move',
                    py: { xs: 0.5, md: 1 },
                  }}
                >
                  <ListItemText primary={`#${order.No}`} primaryTypographyProps={{ sx: { fontSize: { xs: 12, md: 14 } } }} secondary={<Box component="span" sx={{ display:'inline-flex', alignItems:'center', gap:1, fontSize: { xs: 11, md: 13 }, maxWidth: '100%', overflow: 'hidden' }}>
                    <Box component="span" sx={{ width:8, height:8, borderRadius:'50%', bgcolor: (()=>{ const nowH = new Date().getHours(); const h = parseInt(order.PromisedDeliveryHours?.slice(0,2)||'0',10); if (!order.PromisedDeliveryHours) return '#94a3b8'; if (h < nowH) return '#ef4444'; if (h === nowH) return '#f59e0b'; return '#10b981'; })() }} />
                    <Box component="span" sx={{ whiteSpace: { xs: 'nowrap', md: 'normal' }, overflow: 'hidden', textOverflow: 'ellipsis' }}>{`${order.Sell_to_Customer_No || ''}${order.PromisedDeliveryHours ? ' • ' + order.PromisedDeliveryHours : ''}`}</Box>
                  </Box>} />
                  <Tooltip title="Ouvrir">
                    <IconButton size="small" sx={{ display: { xs: 'none', md: 'inline-flex' } }} onClick={() => window.open(`/commandes?order=${encodeURIComponent(order.No)}`, '_blank')}><OpenInNewIcon fontSize="inherit" /></IconButton>
                  </Tooltip>
                </ListItem>
              ))}
            </List>
          </Box>
          {/* Not delivered column */}
          <Box
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, 'not-delivered')}
            sx={{ p: { xs: 0.5, md: 1 }, overflowY: 'visible', minWidth: 0 }}
          >
            <List dense>
              {notDelivered.map((order, index) => (
                <ListItem
                  key={order.No}
                  draggable
                  onDragStart={(e) => handleDragStart(e, order)}
                  sx={{
                    bgcolor: index % 2 === 0 ? '#f9f9f9' : '#fff',
                    borderBottom: '1px solid #e0e0e0',
                    cursor: 'move',
                  }}
                >
                  <ListItemText primary={`#${order.No}`} secondary={<Box component="span" sx={{ display:'inline-flex', alignItems:'center', gap:1, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    <Box component="span" sx={{ width:8, height:8, borderRadius:'50%', bgcolor: (()=>{ const nowH = new Date().getHours(); const h = parseInt(order.PromisedDeliveryHours?.slice(0,2)||'0',10); if (!order.PromisedDeliveryHours) return '#94a3b8'; if (h < nowH) return '#ef4444'; if (h === nowH) return '#f59e0b'; return '#10b981'; })() }} />
                    <Box component="span" sx={{ whiteSpace: { xs: 'nowrap', md: 'normal' }, overflow: 'hidden', textOverflow: 'ellipsis' }}>{`${order.Sell_to_Customer_No || ''}${order.PromisedDeliveryHours ? ' • ' + order.PromisedDeliveryHours : ''}`}</Box>
                  </Box>} />
                  <Tooltip title="Ouvrir">
                    <IconButton size="small" sx={{ display: { xs: 'none', md: 'inline-flex' } }} onClick={() => window.open(`/commandes?order=${encodeURIComponent(order.No)}`, '_blank')}><OpenInNewIcon fontSize="inherit" /></IconButton>
                  </Tooltip>
                </ListItem>
              ))}
            </List>
          </Box>
        </Box>
      </Box>
    </Box>
 
  );
};
export default Etat;
