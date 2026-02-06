import { NextRequest, NextResponse } from 'next/server';
import { getValidAccessToken } from '../../functions/token';

export async function PATCH(req: NextRequest) {
  console.log("PATCH /api/updateOrder started");
  try {
    // Parse JSON body safely
    let body;
    try {
      body = await req.json();
    } catch (jsonError) {
      console.error("Invalid JSON body:", jsonError);
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    console.log("Received body:", body);
    const { orderNo, Requested_Delivery_Date, PromisedDeliveryHours } = body;

    // Validate required fields
    if (!orderNo || !Requested_Delivery_Date || !PromisedDeliveryHours) {
      console.error("Missing required fields:", { orderNo, Requested_Delivery_Date, PromisedDeliveryHours });
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get access token
    let accessToken;
    try {
      accessToken = await getValidAccessToken();
    } catch (tokenError) {
      console.error("Failed to get access token:", tokenError);
      return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
    }
    console.log("Access token retrieved");

    const bcUrl = `https://api.businesscentral.dynamics.com/v2.0/38681c7b-907c-49c7-9777-d0e3fabfd826/SandBox/ODataV4/Company(%27CRONUS%20FR%27)/salesorders(Document_Type='Order',No='${orderNo}')`;
    console.log("Sending PATCH to Business Central:", bcUrl);

    // Step 1: Clear Promised_Delivery_Date
    const clearResponse = await fetch(bcUrl, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'If-Match': '*',
      },
      body: JSON.stringify({
        promisedDeliveryDate: null,
      }),
    });

    const clearBcResponse = await clearResponse.json();
    console.log("Clear Promised Delivery Date response:", clearBcResponse);

    if (!clearResponse.ok) {
      console.error("Failed to clear Promised Delivery Date:", clearBcResponse, "Status:", clearResponse.status);
      return NextResponse.json({ error: clearBcResponse }, { status: clearResponse.status });
    }

    // Step 2: Update Requested_Delivery_Date and PromisedDeliveryHours
    const updateResponse = await fetch(bcUrl, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'If-Match': '*',
      },
      body: JSON.stringify({
        Requested_Delivery_Date,
        PromisedDeliveryHours,
      }),
    });

    const updateBcResponse = await updateResponse.json();
    console.log("Update response:", updateBcResponse);

    if (!updateResponse.ok) {
      console.error("Business Central error:", updateBcResponse, "Status:", updateResponse.status);
      return NextResponse.json({ error: updateBcResponse }, { status: updateResponse.status });
    }

    console.log("PATCH successful");
    return NextResponse.json({ message: 'Sales order updated successfully' }, { status: 200 });
  } catch (error) {
    // Safely extract error message
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Update failed:", error);
    return NextResponse.json({ error: 'Internal Server Error', details: errorMessage }, { status: 500 });
  }
}
  

