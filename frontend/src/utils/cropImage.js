export const getCroppedImg = async (imageSrc, croppedAreaPixels) => {
  return new Promise((resolve) => {
    const image = new Image();
    image.src = imageSrc;
    image.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      // Profile photos show small, so cap the output at 512 px. A crop of a full-size
      // phone photo would otherwise be several MB and go over the 2 MB upload limit.
      const MAX_SIZE = 512;
      const scale = Math.min(
        1,
        MAX_SIZE / Math.max(croppedAreaPixels.width, croppedAreaPixels.height),
      );
      canvas.width = Math.round(croppedAreaPixels.width * scale);
      canvas.height = Math.round(croppedAreaPixels.height * scale);

      ctx.drawImage(
        image,
        croppedAreaPixels.x,
        croppedAreaPixels.y,
        croppedAreaPixels.width,
        croppedAreaPixels.height,
        0,
        0,
        canvas.width,
        canvas.height,
      );

      ctx.drawImage(
        image,
        croppedAreaPixels.x,
        croppedAreaPixels.y,
        croppedAreaPixels.width,
        croppedAreaPixels.height,
        0,
        0,
        croppedAreaPixels.width,
        croppedAreaPixels.height,
      );

      resolve(canvas.toDataURL("image/jpeg"));
    };
  });
};
