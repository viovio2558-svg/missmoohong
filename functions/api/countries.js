export async function onRequestGet({ env }) {
 const { results = [] } = await env.DB.prepare("SELECT id, continent, flag, name, status FROM countries ORDER BY continent, name").all();
 const available = results.filter(c => c.status === "AVAILABLE");
 return Response.json({ countries: available, all: results, availableCount: available.length, totalCount: results.length });
}
