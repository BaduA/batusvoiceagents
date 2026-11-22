import { apiErrorResponse, createAgent } from "@/lib/agents";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    return Response.json(await createAgent(body.config));
  } catch (e) {
    return apiErrorResponse(e);
  }
}
