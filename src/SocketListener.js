class SocketListener {
  /**
   * @param {{name: string, execute(socket: import("socket.io").Socket, data: object, other: {socketIp: string, getUserSocket(id: string): import("socket.io").Socket, awaitResponse(eventName: string, data: any, timeout?: number): Promise<any>, io: import("socket.io").Server}): Promise<any>}} obj 
   */
  constructor(obj) {
    this.name = obj.name;
    this.execute = (...args) => {
      let cancel = () => { };
      let finished = false;
      let promise = new Promise(async (resolve, reject) => {
        cancel = () => {
          if (finished) return;
          reject("Cancelled");
        }
        obj.execute(...args).then(resolve).catch(reject).finally(() => {
          finished = true;
        });
      });
      return { cancel, promise };
    };
  }
}

module.exports = SocketListener;