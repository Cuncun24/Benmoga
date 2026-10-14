# Cómo conectarte desde el celular o el lector Zebra (HTTPS)

La app queda accesible desde cualquier dispositivo en la **misma red Wi-Fi** que el PC,
ahora por **HTTPS** (así funciona también la cámara del celular).

## Requisitos
- PC y celular/lector en la **misma red Wi-Fi**.
- Los dos servidores encendidos (backend y frontend).

## Dirección
```
https://192.168.2.120:5173
```
(usa la IP que imprime el backend al iniciar; puede cambiar si te reconectas a otra Wi-Fi)

---

## Paso 1 (solo una vez): abrir el Firewall de Windows
Clic derecho en **`abrir-firewall-red.cmd`** → **Ejecutar** → aceptar el permiso de
administrador (UAC). Abre el puerto **5173**.

## Paso 2 (solo una vez): generar el certificado para tu IP
Clic derecho en **`generar-certificado.ps1`** → **Ejecutar con PowerShell**.
Crea los archivos en `certs\` para tu IP actual. **Repítelo si cambia la IP.**

## Paso 3: encender los servidores
```powershell
cd backend
npm run dev

cd frontend
npm run dev
```
El backend muestra la IP de la red. El frontend sirve en **HTTPS** en el 5173.

## Paso 4: abrir en el celular
Abre en el navegador:
```
https://192.168.2.120:5173
```

Verás un aviso de **"Tu conexión no es privada"**. Es normal (el certificado es propio):

1. Pulsa **Avanzado** (o "Opciones avanzadas").
2. Pulsa **Continuar a 192.168.2.120 (no seguro)**.
3. Inicia sesión normalmente.

Con eso ya funciona todo en el celular, **incluida la cámara** para escanear.

---

## Opcional: quitar el aviso en el celular (instalar el certificado)
Si quieres que no vuelva a salir el aviso:

1. En el celular abre `https://192.168.2.120:5173/ca.crt` y descarga el archivo.
2. **Ajustes → Seguridad → Cifrado y credenciales → Instalar un certificado →
   Certificado de CA** y elige el archivo descargado.
   (Android puede pedirte poner un PIN/bloqueo de pantalla.)
3. Listo, el aviso desaparece. El certificado se ve como "BENMOGA Inventario CA".

## Opcional: quitar el aviso en el PC
En el PC, la primera vez en `https://localhost:5173` pulsa **Avanzado → Continuar**.
También puedes instalar `certs\ca.crt` como certificado de confianza si lo prefieres.

---

## Preguntas frecuentes
- **¿Por qué ya no entra con `http://`?** Ahora el servidor es HTTPS. Usa siempre
  `https://` (con la "s").
- **Cambió la IP**: vuelve a ejecutar `generar-certificado.ps1` y reinicia el frontend.
- **Escanear con el lector Zebra (TC21/TC20)**: funciona directo, escribe el código
  como teclado en el campo de escaneo.
- **Si el celular no carga**: confirma que estás en la misma Wi-Fi y que ejecutaste
  `abrir-firewall-red.cmd` como administrador.

## Cómo quitar las reglas del Firewall (si algún día quieres)
```powershell
Remove-NetFirewallRule -DisplayName 'BENMOGA Inventario Web (5173)'
```
