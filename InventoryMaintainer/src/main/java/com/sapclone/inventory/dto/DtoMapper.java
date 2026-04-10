package com.sapclone.inventory.dto;

import com.sapclone.inventory.model.CrmLead;

public class DtoMapper {

    public static CrmLeadResponse toResponse(CrmLead entity) {
        if (entity == null) return null;
        CrmLeadResponse response = new CrmLeadResponse();
        response.setId(entity.getId());
        response.setContactName(entity.getContactName());
        response.setContactEmail(entity.getContactEmail());
        response.setContactPhone(entity.getContactPhone());
        response.setCompanyName(entity.getCompanyName());
        response.setPotentialValue(entity.getPotentialValue());
        response.setStatus(entity.getStatus());
        response.setSource(entity.getSource());
        response.setAssignedTo(entity.getAssignedTo());
        response.setAiScore(entity.getAiScore());
        response.setNotes(entity.getNotes());
        response.setConvertedProjectId(entity.getConvertedProjectId());
        response.setCreatedAt(entity.getCreatedAt());
        response.setUpdatedAt(entity.getUpdatedAt());
        return response;
    }

    public static CrmLead toEntity(CrmLeadRequest request) {
        if (request == null) return null;
        CrmLead entity = new CrmLead();
        entity.setContactName(request.getContactName());
        entity.setContactEmail(request.getContactEmail());
        entity.setContactPhone(request.getContactPhone());
        entity.setCompanyName(request.getCompanyName());
        if (request.getPotentialValue() != null) entity.setPotentialValue(request.getPotentialValue());
        if (request.getStatus() != null) entity.setStatus(request.getStatus());
        entity.setSource(request.getSource());
        entity.setAssignedTo(request.getAssignedTo());
        entity.setNotes(request.getNotes());
        return entity;
    }
}
