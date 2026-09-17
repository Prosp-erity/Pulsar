import { readFileSync } from "fs";
import { join } from "path";

export async function GET() {
  try {
    const filePath = join(process.cwd(), "download", "pulsar-app-source.tar.gz");
    const file = readFileSync(filePath);

    return new Response(file, {
      headers: {
        "Content-Type": "application/gzip",
        "Content-Disposition": 'attachment; filename="pulsar-app-source.tar.gz"',
        "Content-Length": file.length.toString(),
      },
    });
  } catch {
    return new Response("File not found", { status: 404 });
  }
}
