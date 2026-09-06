/*
 * This file is part of Cockpit.
 *
 * Copyright (C) 2026 n8n Appliance contributors
 *
 * Cockpit is free software; you can redistribute it and/or modify it
 * under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation; either version 2.1 of the License, or
 * (at your option) any later version.
 */

import cockpit from "cockpit";
import React from "react";

import { Button } from "@patternfly/react-core/dist/esm/components/Button/index.js";
import { DescriptionList, DescriptionListDescription, DescriptionListGroup, DescriptionListTerm } from "@patternfly/react-core/dist/esm/components/DescriptionList/index.js";

const _ = cockpit.gettext;
const STATUS_PATH = "/data/system/pki/status.json";
const PUBLIC_CA_PATH = "/data/system/pki/local-ca.crt";
const PUBLIC_CA_DOWNLOAD_NAME = "n8n-appliance-local-ca.crt";
const PUBLIC_CA_MAX_SIZE = 1024 * 1024;

const providerName = provider => provider === "local" ? _("Local appliance CA") : provider;

const prettyTimestamp = value => {
    if (!value)
        return "";

    const timestamp = new Date(value);
    if (Number.isNaN(timestamp.getTime()))
        return value;

    return timestamp.toLocaleString(cockpit.language.replace('_', '-'));
};

export class AppliancePki extends React.Component {
    constructor() {
        super();
        this.state = { status: null };
        this.downloadPublicCa = this.downloadPublicCa.bind(this);
    }

    componentDidMount() {
        cockpit.file(STATUS_PATH).read()
                .then(content => {
                    if (!content)
                        return;

                    let status;
                    try {
                        status = JSON.parse(content);
                    } catch (error) {
                        this.props.addAlert(_("Appliance PKI status is invalid"), error.message);
                        return;
                    }

                    if (status.schema_version !== 1) {
                        this.props.addAlert(_("Appliance PKI status is unsupported"),
                                            cockpit.format(_("Unsupported schema version $0"), status.schema_version));
                        return;
                    }

                    this.setState({ status });
                })
                .catch(error => {
                    // Absence is expected before local PKI initialization. Other
                    // failures indicate that the deliberately public status
                    // contract is unreadable and should be surfaced.
                    if (error.problem !== "not-found")
                        this.props.addAlert(_("Could not read appliance PKI status"), error.message || String(error));
                });
    }

    downloadPublicCa() {
        // Use Cockpit's authenticated external fsread1 channel rather than
        // materializing the certificate into a browser blob. This preserves
        // Cockpit's default CSP and keeps host file access inside cockpit-bridge.
        const payload = JSON.stringify({
            payload: "fsread1",
            binary: "raw",
            path: PUBLIC_CA_PATH,
            host: cockpit.transport.host,
            external: {
                "content-disposition": `attachment; filename="${PUBLIC_CA_DOWNLOAD_NAME}"`,
                "content-type": "application/x-pem-file",
            },
            max_read_size: PUBLIC_CA_MAX_SIZE,
        });
        const encodedPayload = new TextEncoder().encode(payload);
        const query = window.btoa(String.fromCharCode(...encodedPayload));
        const prefix = (new URL(cockpit.transport.uri("channel/" + cockpit.transport.csrf_token))).pathname;
        window.open(`${prefix}?${query}`);
    }

    render() {
        const { status } = this.state;
        if (!status)
            return null;

        return (
            <section className="appliance-pki" aria-labelledby="appliance-pki-title">
                <div className="appliance-pki-header">
                    <div>
                        <h2 id="appliance-pki-title">{_("Appliance PKI")}</h2>
                        <div>{_("Public trust information for appliance-managed service certificates.")}</div>
                    </div>
                    <Button variant="secondary" onClick={this.downloadPublicCa}>
                        {_("Download CA certificate")}
                    </Button>
                </div>
                <DescriptionList isHorizontal>
                    <DescriptionListGroup>
                        <DescriptionListTerm>{_("Provider")}</DescriptionListTerm>
                        <DescriptionListDescription>{providerName(status.provider)}</DescriptionListDescription>
                    </DescriptionListGroup>
                    <DescriptionListGroup>
                        <DescriptionListTerm>{_("DNS domain")}</DescriptionListTerm>
                        <DescriptionListDescription>{status.dns_domain}</DescriptionListDescription>
                    </DescriptionListGroup>
                    <DescriptionListGroup>
                        <DescriptionListTerm>{_("CA subject")}</DescriptionListTerm>
                        <DescriptionListDescription>{status.ca_subject}</DescriptionListDescription>
                    </DescriptionListGroup>
                    <DescriptionListGroup>
                        <DescriptionListTerm>{_("Initialized")}</DescriptionListTerm>
                        <DescriptionListDescription>{prettyTimestamp(status.initialized_at)}</DescriptionListDescription>
                    </DescriptionListGroup>
                </DescriptionList>
            </section>
        );
    }
}

export default AppliancePki;
