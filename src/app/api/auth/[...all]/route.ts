import { getAuth } from "@/lib/auth";

const handle = (req: Request) => getAuth().handler(req);

export { handle as GET, handle as POST };
