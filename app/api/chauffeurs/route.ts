import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken } from "../../functions/token";

const apiUrl = "https://api.businesscentral.dynamics.com/v2.0/38681c7b-907c-49c7-9777-d0e3fabfd826/SandBox/ODataV4/Company(%27CRONUS%20FR%27)/resapi";

export async function GET(req: NextRequest) {
  try {
    const accessToken = await getValidAccessToken();
    const options = {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    };

    console.log("Making request to:", apiUrl);
    const response = await fetch(apiUrl, options);
    console.log("Response status:", response.status);

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Error response body:", errorBody);
      throw new Error(`Error: ${response.status} - ${errorBody}`);
    }

    const data = await response.json();
    console.log("Received data:", data);

    const items: any[] = Array.isArray((data as any)?.value) ? (data as any).value : [];

    // Filter to return only relevant fields including @odata.etag
    const filteredData = {
      value: items.map((item: any) => ({
        No: item.No,
        Name: item.Name,
        address: item.address,
        city: item.city,
        EmploymentDate: item.EmploymentDate || '',
        jobTitle: item.jobTitle || '',
        TruckRole:item.TruckRole || '',
        "@odata.etag": item["@odata.etag"],
      })),
    };

    return NextResponse.json(filteredData);
  } catch (error: any) {
    console.error("Error occurred:", error.message);
    return NextResponse.json({ value: [] });
  }
}

export async function POST(req: NextRequest) {
  try {
    const accessToken = await getValidAccessToken();
    const body = await req.json();
    // Ensure required fields are present
    const payload = {
      Name: body.Name || '',
      address: body.address || '',
      city: body.city || '',
      EmploymentDate: body.EmploymentDate || '',
      jobTitle: body.jobTitle || '',
      TruckRole: body.TruckRole || '',
    };

    const options = {
      method: 'POST',
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    };

    console.log("Making POST request to:", apiUrl, "with body:", payload);
    const response = await fetch(apiUrl, options);
    console.log("Response status:", response.status);

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Error response body:", errorBody);
      throw new Error(`Error: ${response.status} - ${errorBody}`);
    }

    const data = await response.json();
    console.log("Created chauffeur:", data);

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error occurred:", error.message);
    return NextResponse.json(
      { message: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const no = searchParams.get('No');

  if (!no) {
    return NextResponse.json({ message: "Chauffeur No is required" }, { status: 400 });
  }

  try {
    const accessToken = await getValidAccessToken();
    const body = await req.json();
    // Ensure required fields are present
    const payload = {
      Name: body.Name || '',
      address: body.address || '',
      city: body.city || '',
      EmploymentDate: body.EmploymentDate || '',
      jobTitle: body.jobTitle || '',
    };

    const options = {
      method: 'PATCH',
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        "If-Match": body["@odata.etag"] || '',
      },
      body: JSON.stringify(payload),
    };

    const updateUrl = `${apiUrl}('${encodeURIComponent(no)}')`;
    console.log("Making PATCH request to:", updateUrl, "with body:", payload, "and If-Match:", body["@odata.etag"]);
    const response = await fetch(updateUrl, options);
    console.log("Response status:", response.status);

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Error response body:", errorBody);
      throw new Error(`Error: ${response.status} - ${errorBody}`);
    }

    const data = await response.json();
    console.log("Updated chauffeur:", data);

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error occurred:", error.message);
    return NextResponse.json(
      { message: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const no = searchParams.get('No');

  if (!no) {
    return NextResponse.json({ message: "Chauffeur No is required" }, { status: 400 });
  }

  try {
    const accessToken = await getValidAccessToken();
    const options = {
      method: 'DELETE',
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    };

    const deleteUrl = `${apiUrl}('${encodeURIComponent(no)}')`;
    console.log("Making DELETE request to:", deleteUrl);
    const response = await fetch(deleteUrl, options);
    console.log("Response status:", response.status);

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Error response body:", errorBody);
      throw new Error(`Error: ${response.status} - ${errorBody}`);
    }

    return NextResponse.json({ message: "Chauffeur deleted successfully" });
  } catch (error: any) {
    console.error("Error occurred:", error.message);
    return NextResponse.json(
      { message: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}