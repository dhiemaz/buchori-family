FROM nginx:alpine
# openssl is needed by entrypoint.sh to generate the temporary self-signed cert
RUN apk add --no-cache openssl
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
