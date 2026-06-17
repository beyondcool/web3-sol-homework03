import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("XXXModule", (m) => {
  const counter = m.contract("XXX");
  return { counter };
});
