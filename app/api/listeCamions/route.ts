import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken } from "../../functions/token";

const apiUrl =
  "https://api.businesscentral.dynamics.com/v2.0/38681c7b-907c-49c7-9777-d0e3fabfd826/SandBox/ODataV4/Company(%27CRONUS%20FR%27)/TruckTrans";

export async function GET(req: NextRequest) {
  const accessToken = await getValidAccessToken();
  try {
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

    // Filter to return only relevant fields including @odata.etag
    const filteredData = {
      value: data.value.map((item: any) => ({
        No: item.No,
        Description: item.Description,
        Make: item.Make,
        Model: item.Model,
        Year: item.Year,
        License_Plate: item.License_Plate,
        Status: item.Status,
        Resource_No: item.Resource_No,
        "@odata.etag": item["@odata.etag"],
      })),
    };

    return NextResponse.json(filteredData);
  } catch (error: any) {
    console.error("Error occurred:", error.message);
    return NextResponse.json(
      { message: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const accessToken = await getValidAccessToken();
  try {
    const body = await req.json();
    // Ensure required fields are present
    const payload = {
      Description: body.Description || '',
      Make: body.Make || '',
      Model: body.Model || '',
      Year: body.Year || '',
      License_Plate: body.License_Plate || '',
      Status: body.Status || '',
      Resource_No: body.Resource_No || '',
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
    console.log("Created truck:", data);

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
  const accessToken = await getValidAccessToken();
  const { searchParams } = new URL(req.url);
  const no = searchParams.get('No');

  if (!no) {
    return NextResponse.json({ message: "Truck No is required" }, { status: 400 });
  }

  try {
    const body = await req.json();
    // Ensure required fields are present
    const payload = {
      Description: body.Description || '',
      Make: body.Make || '',
      Model: body.Model || '',
      Year: body.Year || '',
      License_Plate: body.License_Plate || '',
      Status: body.Status || '',
      Resource_No: body.Resource_No || '',
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
    console.log("Updated truck:", data);

    // Return only relevant fields including @odata.etag
    const filteredData = {
      No: data.No,
      Description: data.Description,
      Make: data.Make,
      Model: data.Model,
      Year: data.Year || '',
      License_Plate: data.License_Plate || '',
      Status: data.Status || '',
      Resource_No: data.Resource_No || '',
      "@odata.etag": data["@odata.etag"],
    };

    return NextResponse.json(filteredData);
  } catch (error: any) {
    console.error("Error occurred:", error.message);
    return NextResponse.json(
      { message: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const accessToken = await getValidAccessToken();
  const { searchParams } = new URL(req.url);
  const no = searchParams.get('No');

  if (!no) {
    return NextResponse.json({ message: "Truck No is required" }, { status: 400 });
  }

  try {
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

    return NextResponse.json({ message: "Truck deleted successfully" });
  } catch (error: any) {
    console.error("Error occurred:", error.message);
    return NextResponse.json(
      { message: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}