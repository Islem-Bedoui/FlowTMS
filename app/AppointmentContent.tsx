import React from "react";
import { Appointments } from "@devexpress/dx-react-scheduler-material-ui";

const AppointmentContent = ({ children, appointmentData, ...restProps }: any) => {
  if (!appointmentData || !appointmentData.startDate || !appointmentData.endDate) {
    return <Appointments.AppointmentContent {...restProps} appointmentData={appointmentData}>{children}</Appointments.AppointmentContent>;
  }
  // Format time
  const start = new Date(appointmentData.startDate);
  const end = new Date(appointmentData.endDate);
  const pad = (n: number) => n.toString().padStart(2, '0');
  const timeStr = `${pad(start.getHours())}:${pad(start.getMinutes())} - ${pad(end.getHours())}:${pad(end.getMinutes())}`;

  return (
    <Appointments.AppointmentContent {...restProps} appointmentData={appointmentData}>
      <div style={{ color: 'white', fontWeight: 600, fontSize: 15, lineHeight: 1.2 }}>
        {appointmentData.title}
      </div>
      <div style={{ color: 'white', fontWeight: 400, fontSize: 14 }}>
        {timeStr}
      </div>
    </Appointments.AppointmentContent>
  );
};

export default AppointmentContent;