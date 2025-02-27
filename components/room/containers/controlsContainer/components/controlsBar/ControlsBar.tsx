import { useState,useMemo } from "react";

import { IconContext } from "react-icons";

//hooks
import { useScreenRecorder } from "./hooks/useScreenRecorder";

//types
import { CONNECTION_MANAGER_ACTIONS } from "@core/connectionManager/types";

//icons
import { BsCameraVideo } from "react-icons/bs";
import { BiMicrophone } from "react-icons/bi";
import { IoIosRecording } from "react-icons/io";
import { MdCall } from "react-icons/md";
import { BsThreeDotsVertical } from "react-icons/bs";
import { SlScreenDesktop } from "react-icons/sl";

const ICON_CLASS =
  "flex-1 flex h-full w-full items-center justify-center hover:rounded-full hover:bg-slate-800	hover:cursor-pointer";

export const ControlsBar = ({ onAction }: any) => {
  const { onAction: onScreenRecorderAction, recorderActionStyles } =
    useScreenRecorder();

    const [isMuted  , setIsMuted]=useState(true);

    const handleMicClick=()=>{
      console.log("Click ? ");
      onAction({type:isMuted?"UNMUTE":"MUTE"});
      setIsMuted((prev)=>(!prev));
    }

  return (
    <IconContext.Provider value={{ color: "white" }}>
      <div className="flex flex-row h-full">
        <div
          className="rounded flex-1 flex items-center justify-center gap-2 box-border border-2 border-indigo-700 p-1"
          style={{ backgroundColor: "#34363b" }}
        >
          <div className={ICON_CLASS}>
            <BsCameraVideo />
          </div>
          <div className={ICON_CLASS} onClick={handleMicClick}>
            <BiMicrophone />
          </div>
          <IconContext.Provider
            value={{
              color: recorderActionStyles.color,
              style: { cursor: recorderActionStyles.cursor },
            }}
          >
            <div className={ICON_CLASS} onClick={onScreenRecorderAction}>
              <IoIosRecording />
            </div>
          </IconContext.Provider>
          <div className={ICON_CLASS}>
            <SlScreenDesktop />
          </div>
          <IconContext.Provider value={{ color: "red" }}>
            <div className={ICON_CLASS}>
              <MdCall />
            </div>
          </IconContext.Provider>
        </div>

        <div
          className="rounded flex items-center justify-center ml-3 box-border border-2 border-indigo-700 w-12"
          style={{ backgroundColor: "#34363b" }}
        >
          <div className={ICON_CLASS}>
            <BsThreeDotsVertical />
          </div>
        </div>
      </div>
    </IconContext.Provider>
  );
};
