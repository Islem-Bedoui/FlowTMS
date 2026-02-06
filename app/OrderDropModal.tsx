import React from "react";
import { Dialog, DialogActions, DialogContent, DialogTitle, Button, TextField } from "@mui/material";
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DatePicker, TimePicker } from "@mui/x-date-pickers";

interface OrderDropModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (date: Date, order: any) => void;
  order: any;
  initialDate: Date;
  fixedDate?: Date;
}

export default function OrderDropModal({ open, onClose, onConfirm, order, initialDate, fixedDate }: OrderDropModalProps) {
  const [date, setDate] = React.useState<Date>(fixedDate ?? initialDate);
  const [time, setTime] = React.useState<Date>(initialDate);

  React.useEffect(() => {
    setDate(fixedDate ?? initialDate);
    setTime(fixedDate ?? initialDate);
  }, [initialDate, open, fixedDate]);

  const handleConfirm = () => {
    const selected = new Date(date);
    selected.setHours(time.getHours(), time.getMinutes(), 0, 0);
    onConfirm(selected, order);
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Ajouter l'ordre {order?.No} dans le calendrier</DialogTitle>
      <DialogContent>
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          {fixedDate ? (
            <TextField
              label="Date"
              value={fixedDate.toLocaleDateString()}
              fullWidth
              margin="normal"
              InputProps={{ readOnly: true }}
            />
          ) : (
            <DatePicker
              label="Date"
              value={date}
              onChange={val => val && setDate(val)}
              renderInput={params => <TextField {...params} fullWidth margin="normal" />}
            />
          )}
          <TimePicker
            label="Heure"
            value={time}
            onChange={val => val && setTime(val)}
            renderInput={params => <TextField {...params} fullWidth margin="normal" />}
          />
        </LocalizationProvider>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Annuler</Button>
        <Button onClick={handleConfirm} variant="contained">Ajouter</Button>
      </DialogActions>
    </Dialog>
  );
}