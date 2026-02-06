'use client';

import React, { useState, useEffect, useRef } from "react";

import {
  Scheduler,
  Toolbar,
  Appointments,
  WeekView,
  MonthView,
  DayView,
  AppointmentForm,
  AppointmentTooltip,
  DragDropProvider,
} from "@devexpress/dx-react-scheduler-material-ui";
import {
  ViewState,
  EditingState,
  IntegratedEditing,
  ChangeSet,
} from "@devexpress/dx-react-scheduler";
import {
  Paper,
  Box,
  Button,
  Typography,
  List,
  ListItem,
  ListItemText,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  IconButton,
  Drawer,
  Fab,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import AppointmentContent from "../AppointmentContent";

const colorForType = (t?: string) => {
  const key = (t || '').toLowerCase();
  if (key.includes('order') || key.includes('commande')) return '#3b82f6';
  if (key.includes('return') || key.includes('retour')) return '#ef4444';
  if (key.includes('quote') || key.includes('devis')) return '#10b981';
  return '#6366f1';
};

const CustomTimeTableCell = (Component: any) => (props: any) => {
  const dateStr = props.startDate?.toISOString().slice(0, 10);
  const timeStr = props.startDate?.toTimeString().slice(0, 5);
  return <Component {...props} data-date={dateStr} data-time={timeStr} />;
};

const CustomToolbar = (props: any) => {
  const { currentDate, onCurrentDateChange } = props;

  const goPrev = () => {
    const d = new Date(currentDate);
    d.setMonth(d.getMonth() - 1);
    onCurrentDateChange(d);
  };

  const goNext = () => {
    const d = new Date(currentDate);
    d.setMonth(d.getMonth() + 1);
    onCurrentDateChange(d);
  };

  return (
    <Toolbar {...props}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", gap: 2 }}>
        <IconButton onClick={goPrev} size="small">
          <ArrowBackIcon />
        </IconButton>
        {props.children}
        <IconButton onClick={goNext} size="small">
          <ArrowForwardIcon />
        </IconButton>
      </Box>
    </Toolbar>
  );
};

interface Order {
  No: string;
  Document_Type: string;
  Sell_to_Customer_No?: string;
  Requested_Delivery_Date?: string;
  PromisedDeliveryHours?: string;
  Assigned_Driver_No?: string;
  assignedTruckNo?: string;
}

const fetchOrders = async (retries = 3): Promise<Order[]> => {
  try {
    const res = await fetch("/api/salesOrders");
    if (!res.ok) throw new Error("Erreur API");
    const data = await res.json();

    const role = (localStorage.getItem("userRole") || "").trim().toLowerCase();
    const driverNo = (localStorage.getItem("driverNo") || "").trim();
    const currentUser = (localStorage.getItem("userIdentifier") || "").trim();
    const effectiveDriverNo = driverNo || currentUser;
    return (data?.value || [])
      .filter((o: any) => {
        if (role === "admin") return o.status === "Open";
        return String(o?.Assigned_Driver_No || "").trim() === effectiveDriverNo && o.status === "Open";
      })
      .map((o: any) => ({
        No: o.No,
        Document_Type: o.Document_Type,
        Sell_to_Customer_No: o.Sell_to_Customer_No,
        Requested_Delivery_Date: o.Requested_Delivery_Date,
        PromisedDeliveryHours: o.PromisedDeliveryHours,
        Assigned_Driver_No: o.Assigned_Driver_No,
        assignedTruckNo: o.assignedTruckNo,
      }));
  } catch (err) {
    if (retries > 0) {
      await new Promise(r => setTimeout(r, 1000));
      return fetchOrders(retries - 1);
    }
    return [];
  }
};

const StyledAppointment = (props: any) => (
  <Appointments.Appointment
    {...props}
    style={{
      borderRadius: 10,
      border: '1px solid #93c5fd',
      background: '#114487ff',
      color: '#0f172a',
      fontSize: 12,
      padding: '2px 4px',
    }}
  />
);

// Pro table look: refine time cells/labels and headers
const ProTimeTableCell = (Enhance: any) => (props: any) => {
  const now = new Date();
  const d: Date | undefined = props?.startDate;
  const isCurrentHour = d && now.toDateString() === d.toDateString() && now.getHours() === d.getHours();
  const isWeekend = d ? d.getDay() === 0 || d.getDay() === 6 : false;
  return (
    <Enhance
      {...props}
      style={{
        borderColor: '#eaeef3',
        background: isWeekend ? '#fafafa' : '#fff',
        ...(isCurrentHour
          ? { boxShadow: 'inset 0 0 0 2px #2563eb', background: '#eff6ff' }
          : {}),
      }}
    />
  );
};

const ProTimeScaleLabel = (Enhance: any) => (props: any) => (
  <Enhance
    {...props}
    style={{
      color: '#334155',
      fontWeight: 700,
      fontSize: 12,
    }}
  />
);

const ProDayScaleCell = (Enhance: any) => (props: any) => {
  const d: Date | undefined = props?.startDate;
  const now = new Date();
  const isToday = d ? d.toDateString() === now.toDateString() : false;
  const isWeekend = d ? d.getDay() === 0 || d.getDay() === 6 : false;
  return (
    <Enhance
      {...props}
      style={{
        background: isToday ? '#dbeafe' : '#f8fafc',
        borderColor: '#eaeef3',
        textTransform: 'uppercase',
        fontWeight: 700,
        color: isWeekend ? '#64748b' : '#334155',
        fontSize: 11,
        padding: '4px 6px',
      }}
    />
  );
};

// Custom Details form content used by AppointmentForm
const ProFormBasicLayout = (props: any) => {
  const { appointmentData } = props;
  if (!appointmentData) {
    return <AppointmentForm.BasicLayout {...props} />;
  }
  const start = appointmentData?.startDate ? new Date(appointmentData.startDate) : undefined;
  const end = appointmentData?.endDate ? new Date(appointmentData.endDate) : undefined;
  const pad = (n: number) => (n ?? 0).toString().padStart(2, '0');
  const dateStr = start ? `${pad(start.getDate())}/${pad(start.getMonth() + 1)}/${start.getFullYear()}` : '';
  const timeStr = start && end ? `${pad(start.getHours())}:${pad(start.getMinutes())} - ${pad(end.getHours())}:${pad(end.getMinutes())}` : '';
  return (
    <AppointmentForm.BasicLayout {...props}>
      <Box sx={{ px: 2, pb: 1, pt: 1 }}>
        <Typography variant="subtitle2" sx={{ color: '#0f172a' }}>Commande</Typography>
        <Typography variant="body2" sx={{ color: '#334155', mb: 1 }}>{appointmentData?.title || '-'}</Typography>
        {!!dateStr && (
          <>
            <Typography variant="subtitle2" sx={{ color: '#0f172a' }}>Date</Typography>
            <Typography variant="body2" sx={{ color: '#334155', mb: 1 }}>{dateStr}</Typography>
          </>
        )}
        {!!timeStr && (
          <>
            <Typography variant="subtitle2" sx={{ color: '#0f172a' }}>Heure</Typography>
            <Typography variant="body2" sx={{ color: '#334155', mb: 1 }}>{timeStr}</Typography>
          </>
        )}
        {appointmentData?.Sell_to_Customer_No && (
          <>
            <Typography variant="subtitle2" sx={{ color: '#0f172a' }}>Client</Typography>
            <Typography variant="body2" sx={{ color: '#334155', mb: 1 }}>{appointmentData.Sell_to_Customer_No}</Typography>
          </>
        )}
        {appointmentData?.Document_Type && (
          <>
            <Typography variant="subtitle2" sx={{ color: '#0f172a' }}>Type</Typography>
            <Typography variant="body2" sx={{ color: '#334155' }}>{appointmentData.Document_Type}</Typography>
          </>
        )}
      </Box>
    </AppointmentForm.BasicLayout>
  );
};

// Tooltip polish
const ProTooltipHeader = (props: any) => (
  <AppointmentTooltip.Header
    {...props}
    style={{ background: 'linear-gradient(90deg, #e2e8f0, #dbeafe)', borderBottom: '1px solid #eaeef3' }}
  />
);

const ProTooltipContent = ({ appointmentData, ...restProps }: any) => {
  if (!appointmentData) {
    return <AppointmentTooltip.Content {...restProps} />;
  }
  const start = new Date(appointmentData.startDate);
  const end = new Date(appointmentData.endDate);
  const pad = (n: number) => n.toString().padStart(2, '0');
  const dateStr = `${pad(start.getDate())}/${pad(start.getMonth() + 1)}/${start.getFullYear()}`;
  const timeStr = `${pad(start.getHours())}:${pad(start.getMinutes())} - ${pad(end.getHours())}:${pad(end.getMinutes())}`;
  const accent = colorForType(appointmentData.Document_Type);
  return (
    <AppointmentTooltip.Content {...restProps} appointmentData={appointmentData} style={{ background: '#ffffff' }}>
      <div style={{ display: 'grid', gap: 8, fontSize: 13, color: '#0f172a' }}>
        <div style={{ height: 4, borderRadius: 999, background: accent }} />
        <div><span style={{ color: '#475569', fontWeight: 600 }}>Commande:</span> {appointmentData.title}</div>
        <div><span style={{ color: '#475569', fontWeight: 600 }}>Date:</span> {dateStr}</div>
        <div><span style={{ color: '#475569', fontWeight: 600 }}>Heure:</span> {timeStr}</div>
        {appointmentData.Sell_to_Customer_No && (
          <div><span style={{ color: '#475569', fontWeight: 600 }}>Client:</span> {appointmentData.Sell_to_Customer_No}</div>
        )}
        {appointmentData.Document_Type && (
          <div>
            <span style={{ color: '#475569', fontWeight: 600, marginRight: 6 }}>Type:</span>
            <span style={{
              background: `${accent}22`,
              color: accent,
              border: `1px solid ${accent}44`,
              padding: '2px 6px',
              borderRadius: 999,
              fontWeight: 700,
              fontSize: 12,
            }}>{appointmentData.Document_Type}</span>
          </div>
        )}
      </div>
    </AppointmentTooltip.Content>
  );
};

// Filter unknown DOM event props from Layout to avoid React warnings
const ProTooltipLayout = (props: any) => {
  const { onBackdropClick, appointmentMeta, ...rest } = props || {};
  if (!appointmentMeta || !appointmentMeta.target) return null;
  return <AppointmentTooltip.Layout appointmentMeta={appointmentMeta} {...rest} />;
};

export default function SchedulerPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const isSmallDesktop = useMediaQuery(theme.breakpoints.down("lg"));

  const [orders, setOrders] = useState<Order[]>([]);
  const [appointments, setAppointments] = useState<Array<{ id: string; title: string; startDate: string; endDate: string; Sell_to_Customer_No?: string; Document_Type?: string }>>([]);
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [view, setView] = useState<"day" | "week" | "month">("week");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [openCalendarDialog, setOpenCalendarDialog] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    if (typeof window === 'undefined') return 260;
    const saved = window.localStorage.getItem('scheduler_sidebar_width');
    return saved ? Math.max(160, Math.min(420, parseInt(saved, 10))) : 260;
  });
  const resizingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const onResizeMouseMove = (e: MouseEvent) => {
    if (!resizingRef.current) return;
    const delta = e.clientX - startXRef.current;
    const next = Math.max(160, Math.min(420, startWidthRef.current + delta));
    setSidebarWidth(next);
  };
  const stopResizing = () => {
    if (!resizingRef.current) return;
    resizingRef.current = false;
    document.removeEventListener('mousemove', onResizeMouseMove);
    document.removeEventListener('mouseup', stopResizing);
    try { window.localStorage.setItem('scheduler_sidebar_width', String(sidebarWidth)); } catch {}
  };
  const startResizing = (e: React.MouseEvent) => {
    resizingRef.current = true;
    startXRef.current = e.clientX;
    startWidthRef.current = sidebarWidth;
    document.addEventListener('mousemove', onResizeMouseMove);
    document.addEventListener('mouseup', stopResizing);
  };

  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', onResizeMouseMove);
      document.removeEventListener('mouseup', stopResizing);
    };
  }, []);

  useEffect(() => {
    fetchOrders().then((data) => {
      setOrders(data);

      const apps = data
        .filter((o): o is Order & Required<Pick<Order, "Requested_Delivery_Date" | "PromisedDeliveryHours">> =>
          !!o.Requested_Delivery_Date && !!o.PromisedDeliveryHours
        )
        .map((o) => {
          const [y, m, d] = o.Requested_Delivery_Date.split("-").map(Number);
          const [h, min] = o.PromisedDeliveryHours.split(":").map(Number);
          const start = new Date(y, m - 1, d, h, min);
          const end = new Date(start);
          end.setHours(start.getHours() + 1);

          return {
            id: o.No,
            title: o.No,
            startDate: start.toISOString(),
            endDate: end.toISOString(),
            Sell_to_Customer_No: o.Sell_to_Customer_No,
            Document_Type: o.Document_Type,
          };
        });

      setAppointments(apps);
    });
  }, []);

  const commitChanges = async (changeSet: ChangeSet) => {
    const { changed, deleted } = changeSet;

    if (deleted) {
      setAppointments(prev => prev.filter(a => a.id !== deleted));
      return;
    }

    if (changed) {
      for (const [id, change] of Object.entries(changed)) {
        const appointment = appointments.find(a => a.id === id);
        if (!appointment) continue;

        const c: any = change as any;
        const newStart = new Date(c.startDate ?? appointment.startDate);
        const newEnd = c.endDate
          ? new Date(c.endDate)
          : appointment.endDate
            ? new Date(appointment.endDate)
            : new Date(newStart.getTime() + 60 * 60 * 1000);

        const body = {
          orderNo: id,
          Requested_Delivery_Date: newStart.toISOString().split("T")[0],
          PromisedDeliveryHours: newStart.toTimeString().slice(0, 8),
        };

        let prevAppointments = appointments; // declare prevAppointments here
        try {
          // Optimistic update: apply immediately in UI
          setAppointments(prev =>
            prev.map(a =>
              a.id === id
                ? { ...a, startDate: newStart.toISOString(), endDate: newEnd.toISOString() }
                : a
            )
          );

          const res = await fetch("/api/updateOrder", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          if (!res.ok) throw new Error();
        } catch {
          // Rollback on failure
          setAppointments(prevAppointments);
          alert("Erreur mise à jour");
        }
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    let order: Order;
    try {
      order = JSON.parse(e.dataTransfer.getData("text"));
    } catch {
      return;
    }

    let targetDate = new Date(currentDate);
    targetDate.setHours(8, 0, 0, 0);

    let el: HTMLElement | null = e.target as HTMLElement;
    while (el && !el.hasAttribute?.("data-date")) {
      el = el.parentElement;
    }

    if (el?.hasAttribute("data-date")) {
      const dateStr = el.getAttribute("data-date")!;
      const timeStr = el.getAttribute("data-time");

      const [y, m, d] = dateStr.split("-").map(Number);
      targetDate = new Date(y, m - 1, d);

      if (timeStr) {
        const [h, min] = timeStr.split(":").map(Number);
        targetDate.setHours(h, min);
      } else {
        targetDate.setHours(8, 0);
      }
    }

    const startDate = new Date(targetDate);
    const endDate = new Date(startDate);
    endDate.setHours(startDate.getHours() + 1);

    const body = {
      orderNo: order.No,
      Requested_Delivery_Date: startDate.toISOString().split("T")[0],
      PromisedDeliveryHours: startDate.toTimeString().slice(0, 8),
    };

    try {
      const res = await fetch("/api/updateOrder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();

      const newApp = {
        id: order.No,
        title: order.No,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        Sell_to_Customer_No: order.Sell_to_Customer_No,
        Document_Type: order.Document_Type,
      };

      setAppointments(prev => [...prev.filter(a => a.id !== order.No), newApp]);
    } catch {
      alert("Impossible de planifier");
    }
  };

  return (
    <Box sx={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden", m: 0, p: 0, bgcolor: "#f6f8fc" }}>

      {/* Header compact */}
      <Box sx={{
        background: "linear-gradient(135deg, #eaeef3 0%, #cbd5e1 100%)",
        color: "#0f172a",
        py: 1.25,
        px: 2,
        flexShrink: 0,
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
      }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {isMobile && (
              <IconButton size="small" onClick={() => setDrawerOpen(true)} sx={{ color: "#0f172a" }}>
                <MenuIcon />
              </IconButton>
            )}
            <Typography variant={isMobile ? "subtitle1" : "h6"} fontWeight={800} letterSpacing={0.2}>
            
            </Typography>
          </Box>
          <Box sx={{ display: "flex", gap: 0.5, alignItems: "center" }}>
            {(["day", "week", "month"] as const).map((v) => (
              <Button
                key={v}
                size="small"
                onClick={() => setView(v)}
                sx={{
                  minWidth: { xs: 44, md: 56 },
                  px: 1.25,
                  fontSize: { xs: "0.7rem", md: "0.75rem" },
                  borderRadius: 999,
                  color: "#0f172a",
                  bgcolor: view === v ? "#cbd5e1" : "rgba(15,23,42,0.06)",
                  '&:hover': { bgcolor: view === v ? '#b8c5d3' : 'rgba(15,23,42,0.12)' },
                }}
              >
                {v === "day" ? "Jour" : v === "week" ? "Semaine" : "Mois"}
              </Button>
            ))}
            <IconButton size="small" onClick={() => setOpenCalendarDialog(true)} sx={{ color: "#0f172a" }}>
              <CalendarTodayIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>
      </Box>

      {/* Main */}
      <Box sx={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>
        {/* Sidebar desktop */}
        {!isMobile && (
          <Box sx={{ width: sidebarWidth, flexShrink: 0, borderRight: '1px solid #eaeef3', p: { md: 1.5, lg: 2 }, overflowY: "auto", bgcolor: "white" }}>
            <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ px: 1 }}>
              Commandes
            </Typography>
            <List dense disablePadding sx={{ mt: 1 }}>
              {orders.filter((o) => o.Sell_to_Customer_No).map((order) => (
                <ListItem
                  key={order.No}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text", JSON.stringify(order))}
                  sx={{
                    borderRadius: 2,
                    mb: 1,
                    py: { md: 0.5, lg: 1 },
                    px: { md: 1, lg: 1.25 },
                    bgcolor: "#ffffff",
                    border: "1px solid #e2e8f0",
                    cursor: "grab",
                    transition: 'all .18s ease',
                    '&:hover': { bgcolor: '#f8fafc', borderColor: '#cbd5e1', boxShadow: '0 4px 10px rgba(2,6,23,0.06)', transform: 'translateY(-1px)' },
                  }}
                >
                  <ListItemText
                    primary={order.No}
                    secondary={order.Sell_to_Customer_No}
                    primaryTypographyProps={{ fontSize: { md: "0.8rem", lg: "0.9rem" }, fontWeight: 700, color: "#0f172a", noWrap: true, sx: { overflow: 'hidden', textOverflow: 'ellipsis' } }}
                    secondaryTypographyProps={{ fontSize: { md: "0.7rem", lg: "0.75rem" }, color: "#64748b", noWrap: true, sx: { overflow: 'hidden', textOverflow: 'ellipsis' } }}
                  />
                </ListItem>
              ))}
            </List>
          </Box>
        )}
        {!isMobile && (
          <Box onMouseDown={startResizing} sx={{ width: 6, cursor: 'col-resize', bgcolor: 'transparent', '&:hover': { bgcolor: '#e2e8f0' } }} />
        )}
        {/* Scheduler */}
        <Box sx={{ flex: 1, minWidth: 0, p: { xs: 1.5, md: 3 }, overflowX: 'auto',
          '& .MainLayout-container': { height: '100% !important' },
          '& .Container-container': { height: '100% !important' },
        }} onDragOver={handleDragOver} onDrop={handleDrop}>
          {(() => {
            const schedulerMinWidth = view === 'week' ? 600 : view === 'month' ? 580 : 480;
            return (
          <Paper elevation={0} sx={{
            height: '100%',
            borderRadius: 2.5,
            border: '1px solid #eaeef3',
            background: 'rgba(255,255,255,0.9)',
            backdropFilter: 'blur(6px)',
            overflow: 'hidden',
            minWidth: schedulerMinWidth
          }}>
            <Scheduler data={appointments} locale="fr-FR" height="auto">
              <ViewState currentDate={currentDate} onCurrentDateChange={setCurrentDate} />
              <EditingState onCommitChanges={commitChanges} />
              <IntegratedEditing />
              {view === "day" && (
                <DayView
                  startDayHour={6}
                  endDayHour={20}
                  cellDuration={60}
                  timeTableCellComponent={ProTimeTableCell(CustomTimeTableCell(DayView.TimeTableCell))}
                  timeScaleLabelComponent={ProTimeScaleLabel(DayView.TimeScaleLabel)}
                  dayScaleCellComponent={ProDayScaleCell(DayView.DayScaleCell)}
                />
              )}
              {view === "week" && (
                <WeekView
                  startDayHour={6}
                  endDayHour={20}
                  cellDuration={60}
                  timeTableCellComponent={ProTimeTableCell(CustomTimeTableCell(WeekView.TimeTableCell))}
                  timeScaleLabelComponent={ProTimeScaleLabel(WeekView.TimeScaleLabel)}
                  dayScaleCellComponent={ProDayScaleCell(WeekView.DayScaleCell)}
                />
              )}
              {view === "month" && (
                <MonthView timeTableCellComponent={CustomTimeTableCell(MonthView.TimeTableCell)} />
              )}
              <Toolbar rootComponent={CustomToolbar} />
              <Appointments appointmentComponent={StyledAppointment} appointmentContentComponent={AppointmentContent} />
              <DragDropProvider />
              <AppointmentTooltip layoutComponent={ProTooltipLayout} headerComponent={ProTooltipHeader} contentComponent={ProTooltipContent} showCloseButton showOpenButton showDeleteButton />
              <AppointmentForm />
            </Scheduler>
          </Paper>
            )
          })()}
        </Box>
      </Box>

      {/* Drawer mobile */}
      <Drawer
        anchor="bottom"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{ sx: { borderTopLeftRadius: 16, borderTopRightRadius: 16, p: 2, maxHeight: "60vh", border: '1px solid #eaeef3', backdropFilter: 'blur(8px)' } }}
      >
        <Box sx={{ textAlign: "center", mb: 1 }}>
          <Box sx={{ width: 42, height: 4, bgcolor: "#cbd5e1", borderRadius: 999, mx: "auto", mb: 1 }} />
          <Typography variant="subtitle2" fontWeight={700}>Commandes</Typography>
        </Box>
        <List dense sx={{ overflowY: "auto", display: { xs: 'grid', sm: 'grid' }, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1 }}>
          {orders.filter((o) => o.Sell_to_Customer_No).map((order) => (
            <ListItem
              key={order.No}
              draggable
              onDragStart={(e) => e.dataTransfer.setData("text", JSON.stringify(order))}
              sx={{
                borderRadius: 2,
                mb: 1,
                py: 0.75,
                px: 1,
                bgcolor: "#ffffff",
                border: "1px solid #e2e8f0",
                cursor: "grab",
                transition: 'all .18s ease',
                '&:hover': { bgcolor: '#f8fafc', borderColor: '#cbd5e1', boxShadow: '0 4px 10px rgba(2,6,23,0.06)', transform: 'translateY(-1px)' },
              }}
            >
              <ListItemText
                primary={order.No}
                secondary={order.Sell_to_Customer_No}
                primaryTypographyProps={{ fontSize: { xs: "0.85rem", sm: "0.9rem" }, fontWeight: 700, color: "#0f172a", noWrap: true, sx: { overflow: 'hidden', textOverflow: 'ellipsis' } }}
                secondaryTypographyProps={{ fontSize: { xs: "0.7rem", sm: "0.75rem" }, color: "#64748b", noWrap: true, sx: { overflow: 'hidden', textOverflow: 'ellipsis' } }}
              />
            </ListItem>
          ))}
        </List>
      </Drawer>

      {/* FAB mobile */}
      {isMobile && (
        <Fab
          color="primary"
          size="small"
          onClick={() => setDrawerOpen(true)}
          sx={{ position: "fixed", bottom: 16, right: 16 }}
        >
          <MenuIcon />
        </Fab>
      )}

      {/* Dialog date */}
      <Dialog open={openCalendarDialog} onClose={() => setOpenCalendarDialog(false)} maxWidth="xs" fullWidth fullScreen={isMobile}>
        <DialogTitle>Date</DialogTitle>
        <DialogContent>
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DatePicker
              value={currentDate}
              onChange={(v) => v && setCurrentDate(v as Date)}
              renderInput={(params) => <TextField {...params} fullWidth size="small" />}
            />
          </LocalizationProvider>
        </DialogContent>
        <DialogActions>
          <Button size="small" onClick={() => setOpenCalendarDialog(false)}>Annuler</Button>
          <Button size="small" variant="contained" onClick={() => setOpenCalendarDialog(false)}>OK</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}