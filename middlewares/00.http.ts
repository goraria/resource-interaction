import "@/utils/environment";
import { serviceHttp } from "@/middlewares/http";

export default serviceHttp({
  maxBodySize: 2097152,
  compress: true,
  cors: false,
  insightProxy: false,
});
